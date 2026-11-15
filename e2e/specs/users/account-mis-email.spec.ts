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
  ['From Domain', 'from_domain'],
  ['Campaign Category', 'category'],
  ['Subject Line', 'subject'],
  ['Recipient Domain', 'recipient_domain'],
] as const;

const apiViews = [
  ['Date', 'date'],
  ['From Email', 'from_email'],
  ['Recipient Domain', 'recipient_domain'],
] as const;

const panelOptions = {
  tabs: ['Date & Campaign', 'Date', 'Campaign'],
  more: panelViews.slice(3).map(([view]) => view),
};

// Every API view fits on the bar, so there is no More menu.
const apiOptions = {
  tabs: ['Date', 'From Email', 'Recipient Domain'],
  more: [],
};

const panelFields = [
  'Start Date',
  'End Date',
  'Campaign Name',
  'List Name',
  'Campaign Type',
  'Username',
  'From Email',
  'From Domain',
  'Subject Line',
  'Email Id',
  'Status',
];

const apiFields = [
  'Start Date',
  'End Date',
  'Username',
  'From Email',
  'Template Name',
  'Email Id',
  'Template ID',
  'Number of Opens',
  'Number of Clicks',
  'Status',
];

// Some lists lead with a Select entry and some don't; an empty one says No Records either way.
function listed(shown: string[], offered: string[]): void {
  expect(shown[0] === 'Select' ? shown.slice(1) : shown).toEqual(offered.length > 0 ? offered : ['No Records']);
}

const defaultSearch = {
  from_date: isoDate(daysAgo(1)),
  to_date: isoDate(daysAgo(0)),
  view_counts_by: 'msg_splits',
  limit: 10,
  page: 1,
};

test.describe('Email Account MIS via panel', () => {
  test('opens on yesterday to today with nothing searched yet', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();

    await emailAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
    await emailAccountMisPage.form.expectFields(panelFields);
    await emailAccountMisPage.expectNoResults();
  });

  test('searches campaigns for the dates and collapses the form', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();

    const report = await emailAccountMisPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'campaign' });
    await emailAccountMisPage.table.expectActiveView('Campaign');
    await emailAccountMisPage.table.expectColumnsOf(report);
    await emailAccountMisPage.table.expectRowsOf(report);
    await emailAccountMisPage.table.expectTotalsOf(report);
    await emailAccountMisPage.form.expectCollapsed();

    await emailAccountMisPage.form.expand();
    await emailAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
  });

  // Also guards the view list above: a view the API adds that the list doesn't know fails here.
  test('offers the views the API configures', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();

    const report = await emailAccountMisPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(panelOptions.tabs);
    expect(panelOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await emailAccountMisPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ emailAccountMisPage }) => {
      await emailAccountMisPage.open();
      const opened = await emailAccountMisPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await emailAccountMisPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await emailAccountMisPage.table.expectActiveView(view);
      await emailAccountMisPage.table.expectColumnsOf(report);
      await emailAccountMisPage.table.expectRowsOf(report);
      await emailAccountMisPage.table.expectTotalsOf(report);
    });
  }

  test('searches a typed date range', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();
    await emailAccountMisPage.form.setDates(daysAgo(10), daysAgo(3));

    const report = await emailAccountMisPage.form.search();

    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await emailAccountMisPage.form.expectDates(daysAgo(10), daysAgo(3));
  });

  test('lists the accounts with traffic in the period', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();

    const { params, offered, shown } = await emailAccountMisPage.form.listOptions('Username');

    expect(params.get('field')).toBe('username');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('lists the campaigns the accounts ran in the period', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();

    const { params, offered, shown } = await emailAccountMisPage.form.listOptions('Campaign Name');

    expect(params.get('field')).toBe('campaign_name');
    listed(shown, offered);
  });

  test('lists the delivery statuses with All first', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();

    const { params, offered, shown } = await emailAccountMisPage.form.listOptions('Status');

    expect(params.get('field')).toBe('status');
    expect(offered[0]).toBe('All');
    expect(shown).toEqual(offered);
  });

  test('searches one account picked from the list', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();
    const [username] = (await emailAccountMisPage.form.listOptions('Username')).offered;
    test.skip(username === undefined, 'No account under this one sent email yesterday or today.');
    await emailAccountMisPage.form.select('Username', username);

    const report = await emailAccountMisPage.form.search();

    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.user_name)).toEqual(report.docs.map(() => username));
    await emailAccountMisPage.table.expectRowsOf(report);
  });

  test('searches one campaign picked from the list', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();
    const [campaign] = (await emailAccountMisPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No account under this one ran an email campaign yesterday or today.');
    await emailAccountMisPage.form.select('Campaign Name', campaign);

    const report = await emailAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'select', value: campaign });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.campaign_name)).toEqual(report.docs.map(() => campaign));
    await emailAccountMisPage.table.expectRowsOf(report);
  });

  test('searches campaigns whose name contains text', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();
    await emailAccountMisPage.form.contains('Campaign Name', 'Campaign');

    const report = await emailAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'contains', value: 'Campaign' });
    expect(report.docs.every((doc) => /campaign/i.test(String(doc.campaign_name)))).toBe(true);
    await emailAccountMisPage.table.expectRowsOf(report);
  });

  test('leaves out campaigns whose name contains text', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();
    await emailAccountMisPage.form.doesNotContain('Campaign Name', 'Campaign');

    const report = await emailAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'not_contains', value: 'Campaign' });
    expect(report.docs.some((doc) => String(doc.campaign_name).includes('Campaign'))).toBe(false);
    await emailAccountMisPage.table.expectRowsOf(report);
  });

  test('searches one delivery status', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();
    await emailAccountMisPage.form.select('Status', 'Delivered');

    const report = await emailAccountMisPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await emailAccountMisPage.table.expectRowsOf(report);
  });

  test('keeps the filters when the view changes', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();
    await emailAccountMisPage.form.select('Status', 'Delivered');
    await emailAccountMisPage.form.search();

    const report = await emailAccountMisPage.table.viewBy('Date');

    expect(report.body.group_by).toBe('date');
    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
  });

  test('reloads from the first page when the page size changes', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();
    await emailAccountMisPage.form.search();

    const report = await emailAccountMisPage.table.setPageSize(25);

    // The page posts the chosen size as a string, unlike the number it posts on Search.
    expect(Number(report.body.limit)).toBe(25);
    expect(report.body.page).toBe(1);
  });
});

test.describe('Email Account MIS via API', () => {
  test('opens on yesterday to today with the API fields', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();
    await emailAccountMisPage.openViaApi();

    await emailAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
    await emailAccountMisPage.form.expectFields(apiFields);
    await emailAccountMisPage.expectNoResults();
  });

  test('searches API emails by date', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();
    await emailAccountMisPage.openViaApi();

    const report = await emailAccountMisPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'date' });
    await emailAccountMisPage.table.expectActiveView('Date');
    await emailAccountMisPage.table.expectColumnsOf(report);
    await emailAccountMisPage.table.expectRowsOf(report);
    await emailAccountMisPage.table.expectTotalsOf(report);
    await emailAccountMisPage.form.expectCollapsed();
  });

  test('offers the views the API configures', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();
    await emailAccountMisPage.openViaApi();

    const report = await emailAccountMisPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(apiOptions.tabs);
    expect(apiOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await emailAccountMisPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ emailAccountMisPage }) => {
      await emailAccountMisPage.open();
      await emailAccountMisPage.openViaApi();
      const opened = await emailAccountMisPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await emailAccountMisPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await emailAccountMisPage.table.expectActiveView(view);
      await emailAccountMisPage.table.expectColumnsOf(report);
      await emailAccountMisPage.table.expectRowsOf(report);
      await emailAccountMisPage.table.expectTotalsOf(report);
    });
  }

  test('lists the accounts with API traffic in the period', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();
    await emailAccountMisPage.openViaApi();

    const { params, offered, shown } = await emailAccountMisPage.form.listOptions('Username');

    expect(params.get('field')).toBe('username');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('searches one delivery status', async ({ emailAccountMisPage }) => {
    await emailAccountMisPage.open();
    await emailAccountMisPage.openViaApi();
    await emailAccountMisPage.form.select('Status', 'Delivered');

    const report = await emailAccountMisPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await emailAccountMisPage.table.expectRowsOf(report);
    await emailAccountMisPage.table.expectTotalsOf(report);
  });
});
