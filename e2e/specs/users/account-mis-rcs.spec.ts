import { expect, test } from '../../fixtures/test-fixtures';
import { daysAgo, isoDate } from '../../utils/date-time';
import { viewsOf } from '../../utils/report-response';

// Read-only. Account MIS reports the traffic of the accounts under this one, through the search
// form of the advanced reports plus a Username field. Nothing loads until Search is clicked, so
// each test pins down what the form posts and that the results are built from the response. The
// filters offer whatever those accounts have in the period, so tests pick values from the lists.

// [view, group_by]. The first is the view a search opens on.
// These are all the views known; an account is offered a subset.
const panelViews = [
  ['Campaign', 'campaign'],
  ['Date & Campaign', 'campaign_name'],
  ['Date', 'date'],
  ['Country', 'country'],
  ['List Name', 'list_id'],
  ['Agent Name', 'agent_name'],
  ['Template Name', 'template_name'],
] as const;

const apiViews = [
  ['Date', 'date'],
  ['Country', 'country'],
  ['Agent Name', 'agent_name'],
  ['Template Name', 'template_name'],
] as const;

const panelOptions = {
  tabs: ['Date & Campaign', 'Date', 'Campaign'],
  more: panelViews.slice(3).map(([view]) => view),
};

const apiOptions = {
  tabs: ['Date'],
  more: apiViews.slice(1).map(([view]) => view),
};

const panelFields = [
  'Start Date',
  'End Date',
  'Agent',
  'Campaign Name',
  'List Name',
  'Status',
  'Country',
  'Username',
  'Content Type',
];

const apiFields = [
  'Start Date',
  'End Date',
  'Agent',
  'Status',
  'Country',
  'Username',
  'Content Type',
];

const defaultSearch = {
  from_date: isoDate(daysAgo(1)),
  to_date: isoDate(daysAgo(0)),
  view_counts_by: 'msg_splits',
  limit: 10,
  page: 1,
};

test.describe('RCS Account MIS via panel', () => {
  test('opens on yesterday to today with nothing searched yet', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();

    await rcsAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
    await rcsAccountMisPage.form.expectFields(panelFields);
    await rcsAccountMisPage.expectNoResults();
  });

  test('searches campaigns for the dates and collapses the form', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();

    const report = await rcsAccountMisPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'campaign' });
    await rcsAccountMisPage.table.expectActiveView('Campaign');
    await rcsAccountMisPage.table.expectColumnsOf(report);
    await rcsAccountMisPage.table.expectRowsOf(report);
    await rcsAccountMisPage.table.expectTotalsOf(report);
    await rcsAccountMisPage.form.expectCollapsed();

    await rcsAccountMisPage.form.expand();
    await rcsAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
  });

  // Also guards the view list above: a view the API adds that the list doesn't know fails here.
  test('offers the views the API configures', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();

    const report = await rcsAccountMisPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(panelOptions.tabs);
    expect(panelOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await rcsAccountMisPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ rcsAccountMisPage }) => {
      await rcsAccountMisPage.open();
      const opened = await rcsAccountMisPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await rcsAccountMisPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await rcsAccountMisPage.table.expectActiveView(view);
      await rcsAccountMisPage.table.expectColumnsOf(report);
      await rcsAccountMisPage.table.expectRowsOf(report);
      await rcsAccountMisPage.table.expectTotalsOf(report);
    });
  }

  test('searches a typed date range', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();
    await rcsAccountMisPage.form.setDates(daysAgo(10), daysAgo(3));

    const report = await rcsAccountMisPage.form.search();

    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await rcsAccountMisPage.form.expectDates(daysAgo(10), daysAgo(3));
  });

  test('lists the accounts with traffic in the period', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();

    const { params, offered, shown } = await rcsAccountMisPage.form.listOptions('Username');

    expect(params.get('field')).toBe('username');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('lists the campaigns the accounts ran in the period', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();

    const { params, offered, shown } = await rcsAccountMisPage.form.listOptions('Campaign Name');

    expect(params.get('field')).toBe('campaign_name');
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('lists the delivery statuses with All first', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();

    const { params, offered, shown } = await rcsAccountMisPage.form.listOptions('Status');

    expect(params.get('field')).toBe('status');
    expect(offered[0]).toBe('All');
    expect(shown).toEqual(offered);
  });

  test('searches one account picked from the list', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();
    const [username] = (await rcsAccountMisPage.form.listOptions('Username')).offered;
    test.skip(username === undefined, 'No account under this one sent RCS messages yesterday or today.');
    await rcsAccountMisPage.form.select('Username', username);

    const report = await rcsAccountMisPage.form.search();

    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.user_name)).toEqual(report.docs.map(() => username));
    await rcsAccountMisPage.table.expectRowsOf(report);
  });

  test('searches one campaign picked from the list', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();
    const [campaign] = (await rcsAccountMisPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No account under this one ran an RCS campaign yesterday or today.');
    await rcsAccountMisPage.form.select('Campaign Name', campaign);

    const report = await rcsAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'select', value: campaign });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.campaign_name)).toEqual(report.docs.map(() => campaign));
    await rcsAccountMisPage.table.expectRowsOf(report);
  });

  test('searches campaigns whose name contains text', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();
    await rcsAccountMisPage.form.contains('Campaign Name', 'Campaign');

    const report = await rcsAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'contains', value: 'Campaign' });
    expect(report.docs.every((doc) => /campaign/i.test(String(doc.campaign_name)))).toBe(true);
    await rcsAccountMisPage.table.expectRowsOf(report);
  });

  test('leaves out campaigns whose name contains text', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();
    await rcsAccountMisPage.form.doesNotContain('Campaign Name', 'Campaign');

    const report = await rcsAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'not_contains', value: 'Campaign' });
    expect(report.docs.some((doc) => String(doc.campaign_name).includes('Campaign'))).toBe(false);
    await rcsAccountMisPage.table.expectRowsOf(report);
  });

  test('searches one delivery status', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();
    await rcsAccountMisPage.form.select('Status', 'Delivered');

    const report = await rcsAccountMisPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await rcsAccountMisPage.table.expectRowsOf(report);
  });

  test('keeps the filters when the view changes', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();
    await rcsAccountMisPage.form.select('Status', 'Delivered');
    await rcsAccountMisPage.form.search();

    const report = await rcsAccountMisPage.table.viewBy('Date');

    expect(report.body.group_by).toBe('date');
    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
  });

  test('reloads from the first page when the page size changes', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();
    await rcsAccountMisPage.form.search();

    const report = await rcsAccountMisPage.table.setPageSize(25);

    // The page posts the chosen size as a string, unlike the number it posts on Search.
    expect(Number(report.body.limit)).toBe(25);
    expect(report.body.page).toBe(1);
  });
});

test.describe('RCS Account MIS via API', () => {
  test('opens on yesterday to today with the API fields', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();
    await rcsAccountMisPage.openViaApi();

    await rcsAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
    await rcsAccountMisPage.form.expectFields(apiFields);
    await rcsAccountMisPage.expectNoResults();
  });

  test('searches API messages by date', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();
    await rcsAccountMisPage.openViaApi();

    const report = await rcsAccountMisPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'date' });
    await rcsAccountMisPage.table.expectActiveView('Date');
    await rcsAccountMisPage.table.expectColumnsOf(report);
    await rcsAccountMisPage.table.expectRowsOf(report);
    await rcsAccountMisPage.table.expectTotalsOf(report);
    await rcsAccountMisPage.form.expectCollapsed();
  });

  test('offers the views the API configures', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();
    await rcsAccountMisPage.openViaApi();

    const report = await rcsAccountMisPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(apiOptions.tabs);
    expect(apiOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await rcsAccountMisPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ rcsAccountMisPage }) => {
      await rcsAccountMisPage.open();
      await rcsAccountMisPage.openViaApi();
      const opened = await rcsAccountMisPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await rcsAccountMisPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await rcsAccountMisPage.table.expectActiveView(view);
      await rcsAccountMisPage.table.expectColumnsOf(report);
      await rcsAccountMisPage.table.expectRowsOf(report);
      await rcsAccountMisPage.table.expectTotalsOf(report);
    });
  }

  test('lists the accounts with API traffic in the period', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();
    await rcsAccountMisPage.openViaApi();

    const { params, offered, shown } = await rcsAccountMisPage.form.listOptions('Username');

    expect(params.get('field')).toBe('username');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('searches one delivery status', async ({ rcsAccountMisPage }) => {
    await rcsAccountMisPage.open();
    await rcsAccountMisPage.openViaApi();
    await rcsAccountMisPage.form.select('Status', 'Delivered');

    const report = await rcsAccountMisPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await rcsAccountMisPage.table.expectRowsOf(report);
    await rcsAccountMisPage.table.expectTotalsOf(report);
  });
});
