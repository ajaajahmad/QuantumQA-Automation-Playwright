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
  ['User ID', 'user_id'],
  ['Date & Campaign', 'campaign_name'],
  ['Date', 'date'],
  ['Country', 'country'],
  ['Sender ID', 'sender_id'],
  ['Operator', 'operator'],
  ['Failure Reasons', 'failure_reason'],
  ['Rejected Reasons', 'rejected_reason'],
  ['List Name', 'list_id'],
  ['Link Click', 'link_click'],
  ['Template ID', 'dlt_template_id'],
  ['Template Name', 'template_name'],
] as const;

const apiViews = [
  ['Date', 'date'],
  ['User ID', 'user_id'],
  ['Sender ID', 'sender_id'],
  ['Operator', 'operator'],
  ['Country', 'country'],
  ['Failure Reasons', 'failure_reason'],
  ['Rejected Reasons', 'rejected_reason'],
  ['Link Click', 'link_click'],
  ['Template ID', 'dlt_template_id'],
  ['Template Name', 'template_name'],
] as const;

const panelOptions = {
  tabs: ['User ID', 'Date & Campaign', 'Date', 'Campaign'],
  more: panelViews.slice(4).map(([view]) => view),
};

const apiOptions = {
  tabs: ['User ID', 'Date', 'Sender ID', 'Operator'],
  more: apiViews.slice(4).map(([view]) => view),
};

const panelFields = [
  'Start Date',
  'End Date',
  'Operator',
  'Circle',
  'Sender ID',
  'Mobile Number',
  'Campaign Name',
  'List Name',
  'Status',
  'Username',
  'View Counts By',
];

const apiFields = [
  'Start Date',
  'End Date',
  'Operator',
  'Circle',
  'Sender ID',
  'Mobile Number',
  'Status',
  'Username',
  'View Counts By',
];

const defaultSearch = {
  from_date: isoDate(daysAgo(1)),
  to_date: isoDate(daysAgo(0)),
  view_counts_by: 'msg_splits',
  limit: 10,
  page: 1,
};

test.describe('SMS Account MIS via panel', () => {
  test('opens on yesterday to today with nothing searched yet', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();

    await smsAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
    await smsAccountMisPage.form.expectFields(panelFields);
    await smsAccountMisPage.form.expectCountedBy('No. of messages');
    await smsAccountMisPage.expectNoResults();
  });

  test('searches campaign message counts for the dates and collapses the form', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();

    const report = await smsAccountMisPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'campaign' });
    await smsAccountMisPage.table.expectActiveView('Campaign');
    await smsAccountMisPage.table.expectColumnsOf(report);
    await smsAccountMisPage.table.expectRowsOf(report);
    await smsAccountMisPage.table.expectTotalsOf(report);
    await smsAccountMisPage.form.expectCollapsed();

    await smsAccountMisPage.form.expand();
    await smsAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
  });

  // Also guards the view list above: a view the API adds that the list doesn't know fails here.
  test('offers the views the API configures', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();

    const report = await smsAccountMisPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(panelOptions.tabs);
    expect(panelOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await smsAccountMisPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ smsAccountMisPage }) => {
      await smsAccountMisPage.open();
      const opened = await smsAccountMisPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await smsAccountMisPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await smsAccountMisPage.table.expectActiveView(view);
      await smsAccountMisPage.table.expectColumnsOf(report);
      await smsAccountMisPage.table.expectRowsOf(report);
      await smsAccountMisPage.table.expectTotalsOf(report);
    });
  }

  test('counts recipients when No. of recipients is chosen', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    await smsAccountMisPage.form.countBy('No. of recipients');

    const report = await smsAccountMisPage.form.search();

    expect(report.body.view_counts_by).toBe('number');
    await smsAccountMisPage.form.expand();
    await smsAccountMisPage.form.expectCountedBy('No. of recipients');
  });

  test('searches a typed date range', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    await smsAccountMisPage.form.setDates(daysAgo(10), daysAgo(3));

    const report = await smsAccountMisPage.form.search();

    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await smsAccountMisPage.form.expectDates(daysAgo(10), daysAgo(3));
  });

  test('lists the accounts with traffic in the period', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();

    const { params, offered, shown } = await smsAccountMisPage.form.listOptions('Username');

    expect(params.get('field')).toBe('username');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('lists the campaigns the accounts ran in the period', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();

    const { params, offered, shown } = await smsAccountMisPage.form.listOptions('Campaign Name');

    expect(params.get('field')).toBe('campaign_name');
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('lists the delivery statuses with All first', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();

    const { params, offered, shown } = await smsAccountMisPage.form.listOptions('Status');

    expect(params.get('field')).toBe('status');
    expect(offered[0]).toBe('All');
    expect(shown).toEqual(offered);
  });

  test('searches one account picked from the list', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    const [username] = (await smsAccountMisPage.form.listOptions('Username')).offered;
    test.skip(username === undefined, 'No account under this one sent SMS yesterday or today.');
    await smsAccountMisPage.form.select('Username', username);

    const report = await smsAccountMisPage.form.search();

    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.user_name)).toEqual(report.docs.map(() => username));
    await smsAccountMisPage.table.expectRowsOf(report);
  });

  test('searches one campaign picked from the list', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    const [campaign] = (await smsAccountMisPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No account under this one ran an SMS campaign yesterday or today.');
    await smsAccountMisPage.form.select('Campaign Name', campaign);

    const report = await smsAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'select', value: campaign });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.campaign_name)).toEqual(report.docs.map(() => campaign));
    await smsAccountMisPage.table.expectRowsOf(report);
  });

  test('searches campaigns whose name contains text', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    await smsAccountMisPage.form.contains('Campaign Name', 'Campaign');

    const report = await smsAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'contains', value: 'Campaign' });
    expect(report.docs.every((doc) => /campaign/i.test(String(doc.campaign_name)))).toBe(true);
    await smsAccountMisPage.table.expectRowsOf(report);
  });

  test('leaves out campaigns whose name contains text', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    await smsAccountMisPage.form.doesNotContain('Campaign Name', 'Campaign');

    const report = await smsAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'not_contains', value: 'Campaign' });
    expect(report.docs.some((doc) => String(doc.campaign_name).includes('Campaign'))).toBe(false);
    await smsAccountMisPage.table.expectRowsOf(report);
  });

  test('searches recipients whose number contains at least 7 digits', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    await smsAccountMisPage.form.contains('Mobile Number', '9184480');

    const report = await smsAccountMisPage.form.search();

    expect(report.body.recipient).toEqual({ key: 'contains', value: '9184480' });
    await smsAccountMisPage.table.expectRowsOf(report);
  });

  test('refuses a mobile number shorter than 7 digits', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    await smsAccountMisPage.form.contains('Mobile Number', '918448');

    await smsAccountMisPage.form.expectSearchRefused('Please enter minimum 7 digits');
    await smsAccountMisPage.expectNoResults();
  });

  test('searches one delivery status', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    await smsAccountMisPage.form.select('Status', 'Delivered');

    const report = await smsAccountMisPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await smsAccountMisPage.table.expectRowsOf(report);
  });

  test('keeps the filters when the view changes', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    await smsAccountMisPage.form.select('Status', 'Delivered');
    await smsAccountMisPage.form.search();

    const report = await smsAccountMisPage.table.viewBy('Date');

    expect(report.body.group_by).toBe('date');
    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
  });

  test('reloads from the first page when the page size changes', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    await smsAccountMisPage.form.search();

    const report = await smsAccountMisPage.table.setPageSize(25);

    // The page posts the chosen size as a string, unlike the number it posts on Search.
    expect(Number(report.body.limit)).toBe(25);
    expect(report.body.page).toBe(1);
  });
});

test.describe('SMS Account MIS via API', () => {
  test('opens on yesterday to today with the API fields', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    await smsAccountMisPage.openViaApi();

    await smsAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
    await smsAccountMisPage.form.expectFields(apiFields);
    await smsAccountMisPage.form.expectCountedBy('No. of messages');
    await smsAccountMisPage.expectNoResults();
  });

  test('searches API message counts by date', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    await smsAccountMisPage.openViaApi();

    const report = await smsAccountMisPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'date' });
    await smsAccountMisPage.table.expectActiveView('Date');
    await smsAccountMisPage.table.expectColumnsOf(report);
    await smsAccountMisPage.table.expectRowsOf(report);
    await smsAccountMisPage.table.expectTotalsOf(report);
    await smsAccountMisPage.form.expectCollapsed();
  });

  test('offers the views the API configures', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    await smsAccountMisPage.openViaApi();

    const report = await smsAccountMisPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(apiOptions.tabs);
    expect(apiOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await smsAccountMisPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ smsAccountMisPage }) => {
      await smsAccountMisPage.open();
      await smsAccountMisPage.openViaApi();
      const opened = await smsAccountMisPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await smsAccountMisPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await smsAccountMisPage.table.expectActiveView(view);
      await smsAccountMisPage.table.expectColumnsOf(report);
      await smsAccountMisPage.table.expectRowsOf(report);
      await smsAccountMisPage.table.expectTotalsOf(report);
    });
  }

  test('lists the accounts with API traffic in the period', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    await smsAccountMisPage.openViaApi();

    const { params, offered, shown } = await smsAccountMisPage.form.listOptions('Username');

    expect(params.get('field')).toBe('username');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('searches one delivery status', async ({ smsAccountMisPage }) => {
    await smsAccountMisPage.open();
    await smsAccountMisPage.openViaApi();
    await smsAccountMisPage.form.select('Status', 'Delivered');

    const report = await smsAccountMisPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await smsAccountMisPage.table.expectRowsOf(report);
    await smsAccountMisPage.table.expectTotalsOf(report);
  });
});
