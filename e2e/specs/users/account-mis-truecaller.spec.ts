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
  ['TC Number', 'tc_number'],
  ['List Name', 'list_id'],
] as const;

const apiViews = [
  ['Date', 'date'],
  ['Country', 'country'],
  ['TC Number', 'tc_number'],
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
  'Sender ID',
  'Campaign Name',
  'List Name',
  'Status',
  'Country',
  'Username',
  'Message Category',
  'Content Type',
];

const apiFields = [
  'Start Date',
  'End Date',
  'Sender ID',
  'Status',
  'Country',
  'Username',
  'Message Category',
  'Content Type',
];

const defaultSearch = {
  from_date: isoDate(daysAgo(1)),
  to_date: isoDate(daysAgo(0)),
  view_counts_by: 'submission',
  limit: 10,
  page: 1,
};

test.describe('Truecaller Account MIS via panel', () => {
  test('opens on yesterday to today with nothing searched yet', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();

    await truecallerAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
    await truecallerAccountMisPage.form.expectFields(panelFields);
    await truecallerAccountMisPage.expectNoResults();
  });

  test('searches campaign submissions for the dates and collapses the form', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();

    const report = await truecallerAccountMisPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'campaign' });
    await truecallerAccountMisPage.table.expectActiveView('Campaign');
    await truecallerAccountMisPage.table.expectColumnsOf(report);
    await truecallerAccountMisPage.table.expectRowsOf(report);
    await truecallerAccountMisPage.table.expectTotalsOf(report);
    await truecallerAccountMisPage.form.expectCollapsed();

    await truecallerAccountMisPage.form.expand();
    await truecallerAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
  });

  // Also guards the view list above: a view the API adds that the list doesn't know fails here.
  test('offers the views the API configures', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();

    const report = await truecallerAccountMisPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(panelOptions.tabs);
    expect(panelOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await truecallerAccountMisPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ truecallerAccountMisPage }) => {
      await truecallerAccountMisPage.open();
      const opened = await truecallerAccountMisPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await truecallerAccountMisPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await truecallerAccountMisPage.table.expectActiveView(view);
      await truecallerAccountMisPage.table.expectColumnsOf(report);
      await truecallerAccountMisPage.table.expectRowsOf(report);
      await truecallerAccountMisPage.table.expectTotalsOf(report);
    });
  }

  test('searches a typed date range', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();
    await truecallerAccountMisPage.form.setDates(daysAgo(10), daysAgo(3));

    const report = await truecallerAccountMisPage.form.search();

    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await truecallerAccountMisPage.form.expectDates(daysAgo(10), daysAgo(3));
  });

  test('lists the accounts with traffic in the period', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();

    const { params, offered, shown } = await truecallerAccountMisPage.form.listOptions('Username');

    expect(params.get('field')).toBe('username');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('lists the campaigns the accounts ran in the period', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();

    const { params, offered, shown } = await truecallerAccountMisPage.form.listOptions('Campaign Name');

    expect(params.get('field')).toBe('campaign_name');
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('lists the delivery statuses with All first', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();

    const { params, offered, shown } = await truecallerAccountMisPage.form.listOptions('Status');

    expect(params.get('field')).toBe('status');
    expect(offered[0]).toBe('All');
    expect(shown).toEqual(offered);
  });

  test('searches one account picked from the list', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();
    const [username] = (await truecallerAccountMisPage.form.listOptions('Username')).offered;
    test.skip(username === undefined, 'No account under this one sent Truecaller messages yesterday or today.');
    await truecallerAccountMisPage.form.select('Username', username);

    const report = await truecallerAccountMisPage.form.search();

    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.user_name)).toEqual(report.docs.map(() => username));
    await truecallerAccountMisPage.table.expectRowsOf(report);
  });

  test('searches one campaign picked from the list', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();
    const [campaign] = (await truecallerAccountMisPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No account under this one ran a Truecaller campaign yesterday or today.');
    await truecallerAccountMisPage.form.select('Campaign Name', campaign);

    const report = await truecallerAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'select', value: campaign });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.campaign_name)).toEqual(report.docs.map(() => campaign));
    await truecallerAccountMisPage.table.expectRowsOf(report);
  });

  test('searches campaigns whose name contains text', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();
    await truecallerAccountMisPage.form.contains('Campaign Name', 'Campaign');

    const report = await truecallerAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'contains', value: 'Campaign' });
    expect(report.docs.every((doc) => /campaign/i.test(String(doc.campaign_name)))).toBe(true);
    await truecallerAccountMisPage.table.expectRowsOf(report);
  });

  test('leaves out campaigns whose name contains text', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();
    await truecallerAccountMisPage.form.doesNotContain('Campaign Name', 'Campaign');

    const report = await truecallerAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'not_contains', value: 'Campaign' });
    expect(report.docs.some((doc) => String(doc.campaign_name).includes('Campaign'))).toBe(false);
    await truecallerAccountMisPage.table.expectRowsOf(report);
  });

  test('searches one delivery status', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();
    await truecallerAccountMisPage.form.select('Status', 'Delivered');

    const report = await truecallerAccountMisPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await truecallerAccountMisPage.table.expectRowsOf(report);
  });

  test('keeps the filters when the view changes', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();
    await truecallerAccountMisPage.form.select('Status', 'Delivered');
    await truecallerAccountMisPage.form.search();

    const report = await truecallerAccountMisPage.table.viewBy('Date');

    expect(report.body.group_by).toBe('date');
    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
  });

  test('reloads from the first page when the page size changes', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();
    await truecallerAccountMisPage.form.search();

    const report = await truecallerAccountMisPage.table.setPageSize(25);

    // The page posts the chosen size as a string, unlike the number it posts on Search.
    expect(Number(report.body.limit)).toBe(25);
    expect(report.body.page).toBe(1);
  });
});

test.describe('Truecaller Account MIS via API', () => {
  test('opens on yesterday to today with the API fields', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();
    await truecallerAccountMisPage.openViaApi();

    await truecallerAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
    await truecallerAccountMisPage.form.expectFields(apiFields);
    await truecallerAccountMisPage.expectNoResults();
  });

  test('searches API submissions by date', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();
    await truecallerAccountMisPage.openViaApi();

    const report = await truecallerAccountMisPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'date' });
    await truecallerAccountMisPage.table.expectActiveView('Date');
    await truecallerAccountMisPage.table.expectColumnsOf(report);
    await truecallerAccountMisPage.table.expectRowsOf(report);
    await truecallerAccountMisPage.table.expectTotalsOf(report);
    await truecallerAccountMisPage.form.expectCollapsed();
  });

  test('offers the views the API configures', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();
    await truecallerAccountMisPage.openViaApi();

    const report = await truecallerAccountMisPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(apiOptions.tabs);
    expect(apiOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await truecallerAccountMisPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ truecallerAccountMisPage }) => {
      await truecallerAccountMisPage.open();
      await truecallerAccountMisPage.openViaApi();
      const opened = await truecallerAccountMisPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await truecallerAccountMisPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await truecallerAccountMisPage.table.expectActiveView(view);
      await truecallerAccountMisPage.table.expectColumnsOf(report);
      await truecallerAccountMisPage.table.expectRowsOf(report);
      await truecallerAccountMisPage.table.expectTotalsOf(report);
    });
  }

  test('lists the accounts with API traffic in the period', async ({ truecallerAccountMisPage }) => {
    // Staging defect: the Via API lists answer 500 for every field except Status.
    test.fail(true, 'the Via API option lists fail on staging');
    await truecallerAccountMisPage.open();
    await truecallerAccountMisPage.openViaApi();

    const { params, offered, shown } = await truecallerAccountMisPage.form.listOptions('Username');

    expect(params.get('field')).toBe('username');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('searches one delivery status', async ({ truecallerAccountMisPage }) => {
    await truecallerAccountMisPage.open();
    await truecallerAccountMisPage.openViaApi();
    await truecallerAccountMisPage.form.select('Status', 'Delivered');

    const report = await truecallerAccountMisPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await truecallerAccountMisPage.table.expectRowsOf(report);
    await truecallerAccountMisPage.table.expectTotalsOf(report);
  });
});
