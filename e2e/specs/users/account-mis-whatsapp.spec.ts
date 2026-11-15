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
  ['WABA Number', 'waba_number'],
  ['Template Name', 'template_name'],
  ['Failure Reasons', 'failure_reason'],
  ['List Name', 'list_id'],
  ['Campaign Type', 'is_direct_send'],
] as const;

const apiViews = [
  ['Date', 'date'],
  ['Country', 'country'],
  ['WABA Number', 'waba_number'],
  ['Template Name', 'template_name'],
  ['Campaign Type', 'is_direct_send'],
  ['Failure Reasons', 'failure_reason'],
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
  'WABA Number',
  'Mobile Number',
  'Campaign Name',
  'List Name',
  'Template',
  'Status',
  'Country',
  'Username',
  'Template Category',
  'View Counts By',
];

const apiFields = [
  'Start Date',
  'End Date',
  'WABA Number',
  'Mobile Number',
  'Status',
  'Country',
  'Username',
  'Template Category',
  'View Counts By',
];

const defaultSearch = {
  from_date: isoDate(daysAgo(1)),
  to_date: isoDate(daysAgo(0)),
  view_counts_by: 'submission',
  limit: 10,
  page: 1,
};

test.describe('WhatsApp Account MIS via panel', () => {
  test('opens on yesterday to today with nothing searched yet', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();

    await whatsAppAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
    await whatsAppAccountMisPage.form.expectFields(panelFields);
    await whatsAppAccountMisPage.form.expectCountedBy('Submission');
    await whatsAppAccountMisPage.expectNoResults();
  });

  test('searches campaign submissions for the dates and collapses the form', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();

    const report = await whatsAppAccountMisPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'campaign' });
    await whatsAppAccountMisPage.table.expectActiveView('Campaign');
    await whatsAppAccountMisPage.table.expectColumnsOf(report);
    await whatsAppAccountMisPage.table.expectRowsOf(report);
    await whatsAppAccountMisPage.table.expectTotalsOf(report);
    await whatsAppAccountMisPage.form.expectCollapsed();

    await whatsAppAccountMisPage.form.expand();
    await whatsAppAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
  });

  // Also guards the view list above: a view the API adds that the list doesn't know fails here.
  test('offers the views the API configures', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();

    const report = await whatsAppAccountMisPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(panelOptions.tabs);
    expect(panelOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await whatsAppAccountMisPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ whatsAppAccountMisPage }) => {
      await whatsAppAccountMisPage.open();
      const opened = await whatsAppAccountMisPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await whatsAppAccountMisPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await whatsAppAccountMisPage.table.expectActiveView(view);
      await whatsAppAccountMisPage.table.expectColumnsOf(report);
      await whatsAppAccountMisPage.table.expectRowsOf(report);
      await whatsAppAccountMisPage.table.expectTotalsOf(report);
    });
  }

  test('counts billable messages when Billable is chosen', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    await whatsAppAccountMisPage.form.countBy('Billable');

    const report = await whatsAppAccountMisPage.form.search();

    expect(report.body.view_counts_by).toBe('billable');
    await whatsAppAccountMisPage.form.expand();
    await whatsAppAccountMisPage.form.expectCountedBy('Billable');
  });

  test('searches a typed date range', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    await whatsAppAccountMisPage.form.setDates(daysAgo(10), daysAgo(3));

    const report = await whatsAppAccountMisPage.form.search();

    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await whatsAppAccountMisPage.form.expectDates(daysAgo(10), daysAgo(3));
  });

  test('lists the accounts with traffic in the period', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();

    const { params, offered, shown } = await whatsAppAccountMisPage.form.listOptions('Username');

    expect(params.get('field')).toBe('username');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('lists the campaigns the accounts ran in the period', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();

    const { params, offered, shown } = await whatsAppAccountMisPage.form.listOptions('Campaign Name');

    expect(params.get('field')).toBe('campaign_name');
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('lists the delivery statuses with All first', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();

    const { params, offered, shown } = await whatsAppAccountMisPage.form.listOptions('Status');

    expect(params.get('field')).toBe('status');
    expect(offered[0]).toBe('All');
    expect(shown).toEqual(offered);
  });

  test('searches one account picked from the list', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    const [username] = (await whatsAppAccountMisPage.form.listOptions('Username')).offered;
    test.skip(username === undefined, 'No account under this one sent WhatsApp messages yesterday or today.');
    await whatsAppAccountMisPage.form.select('Username', username);

    const report = await whatsAppAccountMisPage.form.search();

    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.user_name)).toEqual(report.docs.map(() => username));
    await whatsAppAccountMisPage.table.expectRowsOf(report);
  });

  test('searches one campaign picked from the list', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    const [campaign] = (await whatsAppAccountMisPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No account under this one ran a WhatsApp campaign yesterday or today.');
    // Staging defect: the lists also offer this account's own campaigns, which the report, being
    // of the accounts under it, has no rows for. Seen as a campaign on offer in an empty period.
    const unfiltered = await whatsAppAccountMisPage.form.search();
    test.fail(unfiltered.total === 0, 'the list offers a campaign in a period the report has no rows for');
    await whatsAppAccountMisPage.form.expand();
    await whatsAppAccountMisPage.form.select('Campaign Name', campaign);

    const report = await whatsAppAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'select', value: campaign });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.campaign_name)).toEqual(report.docs.map(() => campaign));
    await whatsAppAccountMisPage.table.expectRowsOf(report);
  });

  test('searches campaigns whose name contains text', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    await whatsAppAccountMisPage.form.contains('Campaign Name', 'Campaign');

    const report = await whatsAppAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'contains', value: 'Campaign' });
    expect(report.docs.every((doc) => /campaign/i.test(String(doc.campaign_name)))).toBe(true);
    await whatsAppAccountMisPage.table.expectRowsOf(report);
  });

  test('leaves out campaigns whose name contains text', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    await whatsAppAccountMisPage.form.doesNotContain('Campaign Name', 'Campaign');

    const report = await whatsAppAccountMisPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'not_contains', value: 'Campaign' });
    expect(report.docs.some((doc) => String(doc.campaign_name).includes('Campaign'))).toBe(false);
    await whatsAppAccountMisPage.table.expectRowsOf(report);
  });

  test('searches recipients whose number contains at least 7 digits', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    await whatsAppAccountMisPage.form.contains('Mobile Number', '9184480');

    const report = await whatsAppAccountMisPage.form.search();

    expect(report.body.recipient).toEqual({ key: 'contains', value: '9184480' });
    await whatsAppAccountMisPage.table.expectRowsOf(report);
  });

  test('refuses a mobile number shorter than 7 digits', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    await whatsAppAccountMisPage.form.contains('Mobile Number', '918448');

    await whatsAppAccountMisPage.form.expectSearchRefused('Please enter minimum 7 digits');
    await whatsAppAccountMisPage.expectNoResults();
  });

  test('searches one delivery status', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    await whatsAppAccountMisPage.form.select('Status', 'Delivered');

    const report = await whatsAppAccountMisPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await whatsAppAccountMisPage.table.expectRowsOf(report);
  });

  test('keeps the filters when the view changes', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    await whatsAppAccountMisPage.form.select('Status', 'Delivered');
    await whatsAppAccountMisPage.form.search();

    const report = await whatsAppAccountMisPage.table.viewBy('Date');

    expect(report.body.group_by).toBe('date');
    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
  });

  test('reloads from the first page when the page size changes', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    await whatsAppAccountMisPage.form.search();

    const report = await whatsAppAccountMisPage.table.setPageSize(25);

    // The page posts the chosen size as a string, unlike the number it posts on Search.
    expect(Number(report.body.limit)).toBe(25);
    expect(report.body.page).toBe(1);
  });
});

test.describe('WhatsApp Account MIS via API', () => {
  test('opens on yesterday to today with the API fields', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    await whatsAppAccountMisPage.openViaApi();

    await whatsAppAccountMisPage.form.expectDates(daysAgo(1), daysAgo(0));
    await whatsAppAccountMisPage.form.expectFields(apiFields);
    await whatsAppAccountMisPage.form.expectCountedBy('Submission');
    await whatsAppAccountMisPage.expectNoResults();
  });

  test('searches API submissions by date', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    await whatsAppAccountMisPage.openViaApi();

    const report = await whatsAppAccountMisPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'date' });
    await whatsAppAccountMisPage.table.expectActiveView('Date');
    await whatsAppAccountMisPage.table.expectColumnsOf(report);
    await whatsAppAccountMisPage.table.expectRowsOf(report);
    await whatsAppAccountMisPage.table.expectTotalsOf(report);
    await whatsAppAccountMisPage.form.expectCollapsed();
  });

  test('offers the views the API configures', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    await whatsAppAccountMisPage.openViaApi();

    const report = await whatsAppAccountMisPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(apiOptions.tabs);
    expect(apiOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await whatsAppAccountMisPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ whatsAppAccountMisPage }) => {
      await whatsAppAccountMisPage.open();
      await whatsAppAccountMisPage.openViaApi();
      const opened = await whatsAppAccountMisPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await whatsAppAccountMisPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await whatsAppAccountMisPage.table.expectActiveView(view);
      await whatsAppAccountMisPage.table.expectColumnsOf(report);
      await whatsAppAccountMisPage.table.expectRowsOf(report);
      await whatsAppAccountMisPage.table.expectTotalsOf(report);
    });
  }

  test('lists the accounts with API traffic in the period', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    await whatsAppAccountMisPage.openViaApi();

    const { params, offered, shown } = await whatsAppAccountMisPage.form.listOptions('Username');

    expect(params.get('field')).toBe('username');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('searches one delivery status', async ({ whatsAppAccountMisPage }) => {
    await whatsAppAccountMisPage.open();
    await whatsAppAccountMisPage.openViaApi();
    await whatsAppAccountMisPage.form.select('Status', 'Delivered');

    const report = await whatsAppAccountMisPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await whatsAppAccountMisPage.table.expectRowsOf(report);
    await whatsAppAccountMisPage.table.expectTotalsOf(report);
  });
});
