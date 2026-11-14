import { expect, test } from '../../fixtures/test-fixtures';
import { daysAgo, isoDate } from '../../utils/date-time';
import { viewsOf } from '../../utils/report-response';

// Read-only. Nothing loads until Search is clicked, so each test pins down what the form posts
// and that the results are built from the response. The filters offer whatever the account has
// in the period, so tests pick values from those lists instead of naming campaigns.

// [view, group_by]. The first is the view a search opens on. Monthly and Yearly are summary-only.
// These are all the views known; an account is offered a subset (not every one gets the reasons views).
const panelViews = [
  ['Campaign', 'campaign'],
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
  ['Campaign Category', 'category'],
] as const;

const apiViews = [
  ['Date', 'date'],
  ['Sender ID', 'sender_id'],
  ['Operator', 'operator'],
  ['Country', 'country'],
  ['Failure Reasons', 'failure_reason'],
  ['Template ID', 'dlt_template_id'],
  ['Template Name', 'template_name'],
] as const;

const panelOptions = {
  tabs: ['Date & Campaign', 'Date', 'Campaign'],
  more: panelViews.slice(3).map(([view]) => view),
};

const apiOptions = {
  tabs: ['Date', 'Sender ID', 'Operator'],
  more: apiViews.slice(3).map(([view]) => view),
};

const panelFields = [
  'Start Date',
  'End Date',
  'Operator',
  'Circle',
  'Sender ID',
  'Mobile Number',
  'Campaign Name',
  'Campaign Category',
  'List Name',
  'Template ID',
  'Status',
  'Executed By',
  'View Counts By',
];

const apiFields = [
  'Start Date',
  'End Date',
  'Operator',
  'Circle',
  'Sender ID',
  'Mobile Number',
  'Tags',
  'GUID',
  'Template ID',
  'Status',
  'View Counts By',
];

const defaultSearch = {
  from_date: isoDate(daysAgo(1)),
  to_date: isoDate(daysAgo(0)),
  view_counts_by: 'msg_splits',
  limit: 10,
  page: 1,
};

test.describe('SMS Advanced Search via panel', () => {
  test('opens on yesterday to today with nothing searched yet', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();

    await smsAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
    await smsAdvancedPage.form.expectFields(panelFields);
    await smsAdvancedPage.form.expectCountedBy('No. of messages');
    await smsAdvancedPage.expectNoResults();
  });

  test('searches campaign message counts for the dates and collapses the form', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();

    const report = await smsAdvancedPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'campaign' });
    await smsAdvancedPage.table.expectActiveView('Campaign');
    await smsAdvancedPage.table.expectColumnsOf(report);
    await smsAdvancedPage.table.expectRowsOf(report);
    await smsAdvancedPage.table.expectTotalsOf(report);
    await smsAdvancedPage.form.expectCollapsed();

    await smsAdvancedPage.form.expand();
    await smsAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
  });

  // Also guards the view list above: a view the API adds that the list doesn't know fails here.
  test('offers the views the API configures', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();

    const report = await smsAdvancedPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(panelOptions.tabs);
    expect(panelOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await smsAdvancedPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ smsAdvancedPage }) => {
      await smsAdvancedPage.open();
      const opened = await smsAdvancedPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await smsAdvancedPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await smsAdvancedPage.table.expectActiveView(view);
      await smsAdvancedPage.table.expectColumnsOf(report);
      await smsAdvancedPage.table.expectRowsOf(report);
      await smsAdvancedPage.table.expectTotalsOf(report);
    });
  }

  test('counts recipients when No. of recipients is chosen', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    await smsAdvancedPage.form.countBy('No. of recipients');

    const report = await smsAdvancedPage.form.search();

    expect(report.body.view_counts_by).toBe('number');
    await smsAdvancedPage.form.expand();
    await smsAdvancedPage.form.expectCountedBy('No. of recipients');
  });

  test('searches a typed date range', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    await smsAdvancedPage.form.setDates(daysAgo(10), daysAgo(3));

    const report = await smsAdvancedPage.form.search();

    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await smsAdvancedPage.form.expectDates(daysAgo(10), daysAgo(3));
  });

  test('lists the campaigns the account ran in the period', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();

    const { params, offered, shown } = await smsAdvancedPage.form.listOptions('Campaign Name');

    expect(params.get('field')).toBe('campaign_name');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('lists the delivery statuses with All first', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();

    const { params, offered, shown } = await smsAdvancedPage.form.listOptions('Status');

    expect(params.get('field')).toBe('status');
    expect(offered[0]).toBe('All');
    expect(shown).toEqual(offered);
  });

  test('searches one campaign picked from the list', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    const [campaign] = (await smsAdvancedPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No SMS campaigns ran yesterday or today.');
    await smsAdvancedPage.form.select('Campaign Name', campaign);

    const report = await smsAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'select', value: campaign });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.campaign_name)).toEqual(report.docs.map(() => campaign));
    await smsAdvancedPage.table.expectRowsOf(report);
  });

  test('searches campaigns whose name contains text', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    const [campaign] = (await smsAdvancedPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No SMS campaigns ran yesterday or today.');
    const part = campaign.slice(0, 9);
    await smsAdvancedPage.form.contains('Campaign Name', part);

    const report = await smsAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'contains', value: part });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.every((doc) => String(doc.campaign_name).includes(part))).toBe(true);
    await smsAdvancedPage.table.expectRowsOf(report);
  });

  test('leaves out campaigns whose name contains text', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    const [campaign] = (await smsAdvancedPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No SMS campaigns ran yesterday or today.');
    const part = campaign.slice(0, 9);
    await smsAdvancedPage.form.doesNotContain('Campaign Name', part);

    const report = await smsAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'not_contains', value: part });
    expect(report.docs.some((doc) => String(doc.campaign_name).includes(part))).toBe(false);
    await smsAdvancedPage.table.expectRowsOf(report);
  });

  test('searches recipients whose number contains at least 7 digits', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    await smsAdvancedPage.form.contains('Mobile Number', '9184480');

    const report = await smsAdvancedPage.form.search();

    expect(report.body.recipient).toEqual({ key: 'contains', value: '9184480' });
    await smsAdvancedPage.table.expectRowsOf(report);
  });

  test('refuses a mobile number shorter than 7 digits', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    await smsAdvancedPage.form.contains('Mobile Number', '918448');

    await smsAdvancedPage.form.expectSearchRefused('Please enter minimum 7 digits');
    await smsAdvancedPage.expectNoResults();
  });

  test('searches one delivery status', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    await smsAdvancedPage.form.select('Status', 'Delivered');

    const report = await smsAdvancedPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await smsAdvancedPage.table.expectRowsOf(report);
  });

  test('keeps the filters when the view changes', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    await smsAdvancedPage.form.select('Status', 'Delivered');
    await smsAdvancedPage.form.search();

    const report = await smsAdvancedPage.table.viewBy('Date');

    expect(report.body.group_by).toBe('date');
    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
  });

  test('reloads from the first page when the page size changes', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    await smsAdvancedPage.form.search();

    const report = await smsAdvancedPage.table.setPageSize(25);

    // The page posts the chosen size as a string, unlike the number it posts on Search.
    expect(Number(report.body.limit)).toBe(25);
    expect(report.body.page).toBe(1);
  });
});

test.describe('SMS Advanced Search via API', () => {
  test('opens on yesterday to today with the API fields', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    await smsAdvancedPage.openViaApi();

    await smsAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
    await smsAdvancedPage.form.expectFields(apiFields);
    await smsAdvancedPage.form.expectCountedBy('No. of messages');
    await smsAdvancedPage.expectNoResults();
  });

  test('searches API message counts by date', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    await smsAdvancedPage.openViaApi();

    const report = await smsAdvancedPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'date' });
    await smsAdvancedPage.table.expectActiveView('Date');
    await smsAdvancedPage.table.expectColumnsOf(report);
    await smsAdvancedPage.table.expectRowsOf(report);
    await smsAdvancedPage.table.expectTotalsOf(report);
    await smsAdvancedPage.form.expectCollapsed();
  });

  test('offers the views the API configures', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    await smsAdvancedPage.openViaApi();

    const report = await smsAdvancedPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(apiOptions.tabs);
    expect(apiOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await smsAdvancedPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ smsAdvancedPage }) => {
      await smsAdvancedPage.open();
      await smsAdvancedPage.openViaApi();
      const opened = await smsAdvancedPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await smsAdvancedPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await smsAdvancedPage.table.expectActiveView(view);
      await smsAdvancedPage.table.expectColumnsOf(report);
      await smsAdvancedPage.table.expectRowsOf(report);
      await smsAdvancedPage.table.expectTotalsOf(report);
    });
  }

  test('lists the sender IDs that sent API messages in the period', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    await smsAdvancedPage.openViaApi();

    const { params, offered, shown } = await smsAdvancedPage.form.listOptions('Sender ID');

    expect(params.get('field')).toBe('sender_id');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('searches by tag and GUID', async ({ smsAdvancedPage }) => {
    await smsAdvancedPage.open();
    await smsAdvancedPage.openViaApi();
    await smsAdvancedPage.form.fill('Tags', 'automation');
    await smsAdvancedPage.form.fill('GUID', 'no-such-guid');

    const report = await smsAdvancedPage.form.search();

    expect(report.body.tag).toEqual({ key: 'equal', value: 'automation' });
    expect(report.body.guid).toEqual({ key: 'equal', value: 'no-such-guid' });
    await smsAdvancedPage.table.expectRowsOf(report);
    await smsAdvancedPage.table.expectTotalsOf(report);
  });
});
