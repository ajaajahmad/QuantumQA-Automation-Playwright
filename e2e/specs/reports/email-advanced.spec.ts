import { expect, test } from '../../fixtures/test-fixtures';
import { daysAgo, isoDate } from '../../utils/date-time';
import { viewsOf } from '../../utils/report-response';

// Read-only. Nothing loads until Search is clicked, so each test pins down what the form posts
// and that the results are built from the response. The filters offer whatever the account has
// in the period, so tests pick values from those lists instead of naming campaigns. This form has
// no View Counts By choice. Not covered: the Number of Opens and Number of Clicks comparisons.

// [view, group_by]. The first is the view a search opens on. Monthly and Yearly are summary-only.
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
  'Campaign Category',
  'List Name',
  'Campaign Type',
  'From Email',
  'From Domain',
  'Subject Line',
  'Email Id',
  'Status',
  'Executed By',
];

const apiFields = [
  'Start Date',
  'End Date',
  'Tags',
  'GUID',
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

test.describe('Email Advanced Search via panel', () => {
  test('opens on yesterday to today with nothing searched yet', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();

    await emailAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
    await emailAdvancedPage.form.expectFields(panelFields);
    await emailAdvancedPage.expectNoResults();
  });

  test('searches campaigns for the dates and collapses the form', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();

    const report = await emailAdvancedPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'campaign' });
    await emailAdvancedPage.table.expectActiveView('Campaign');
    await emailAdvancedPage.table.expectColumnsOf(report);
    await emailAdvancedPage.table.expectRowsOf(report);
    await emailAdvancedPage.table.expectTotalsOf(report);
    await emailAdvancedPage.form.expectCollapsed();

    await emailAdvancedPage.form.expand();
    await emailAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
  });

  // Also guards the view list above: a view the API adds that the list doesn't know fails here.
  test('offers the views the API configures', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();

    const report = await emailAdvancedPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(panelOptions.tabs);
    expect(panelOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await emailAdvancedPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ emailAdvancedPage }) => {
      await emailAdvancedPage.open();
      const opened = await emailAdvancedPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await emailAdvancedPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await emailAdvancedPage.table.expectActiveView(view);
      await emailAdvancedPage.table.expectColumnsOf(report);
      await emailAdvancedPage.table.expectRowsOf(report);
      await emailAdvancedPage.table.expectTotalsOf(report);
    });
  }

  test('searches a typed date range', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();
    await emailAdvancedPage.form.setDates(daysAgo(10), daysAgo(3));

    const report = await emailAdvancedPage.form.search();

    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await emailAdvancedPage.form.expectDates(daysAgo(10), daysAgo(3));
  });

  test('lists the campaigns the account ran in the period', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();

    const { params, offered, shown } = await emailAdvancedPage.form.listOptions('Campaign Name');

    expect(params.get('field')).toBe('campaign_name');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    listed(shown, offered);
  });

  test('lists the delivery statuses with All first', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();

    const { params, offered, shown } = await emailAdvancedPage.form.listOptions('Status');

    expect(params.get('field')).toBe('status');
    expect(offered[0]).toBe('All');
    expect(shown).toEqual(offered);
  });

  test('searches one campaign picked from the list', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();
    const [campaign] = (await emailAdvancedPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No email campaigns ran yesterday or today.');
    await emailAdvancedPage.form.select('Campaign Name', campaign);

    const report = await emailAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'select', value: campaign });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.campaign_name)).toEqual(report.docs.map(() => campaign));
    await emailAdvancedPage.table.expectRowsOf(report);
  });

  test('searches campaigns whose name contains text', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();
    const [campaign] = (await emailAdvancedPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No email campaigns ran yesterday or today.');
    const part = campaign.slice(0, 9);
    await emailAdvancedPage.form.contains('Campaign Name', part);

    const report = await emailAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'contains', value: part });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.every((doc) => String(doc.campaign_name).includes(part))).toBe(true);
    await emailAdvancedPage.table.expectRowsOf(report);
  });

  test('leaves out campaigns whose name contains text', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();
    const [campaign] = (await emailAdvancedPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No email campaigns ran yesterday or today.');
    const part = campaign.slice(0, 9);
    await emailAdvancedPage.form.doesNotContain('Campaign Name', part);

    const report = await emailAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'not_contains', value: part });
    expect(report.docs.some((doc) => String(doc.campaign_name).includes(part))).toBe(false);
    await emailAdvancedPage.table.expectRowsOf(report);
  });

  test('searches one delivery status', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();
    await emailAdvancedPage.form.select('Status', 'Delivered');

    const report = await emailAdvancedPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await emailAdvancedPage.table.expectRowsOf(report);
  });

  test('keeps the filters when the view changes', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();
    await emailAdvancedPage.form.select('Status', 'Delivered');
    await emailAdvancedPage.form.search();

    const report = await emailAdvancedPage.table.viewBy('Date');

    expect(report.body.group_by).toBe('date');
    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
  });

  test('reloads from the first page when the page size changes', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();
    await emailAdvancedPage.form.search();

    const report = await emailAdvancedPage.table.setPageSize(25);

    // The page posts the chosen size as a string, unlike the number it posts on Search.
    expect(Number(report.body.limit)).toBe(25);
    expect(report.body.page).toBe(1);
  });
});

test.describe('Email Advanced Search via API', () => {
  test('opens on yesterday to today with the API fields', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();
    await emailAdvancedPage.openViaApi();

    await emailAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
    await emailAdvancedPage.form.expectFields(apiFields);
    await emailAdvancedPage.expectNoResults();
  });

  test('searches API emails by date', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();
    await emailAdvancedPage.openViaApi();

    const report = await emailAdvancedPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'date' });
    await emailAdvancedPage.table.expectActiveView('Date');
    await emailAdvancedPage.table.expectColumnsOf(report);
    await emailAdvancedPage.table.expectRowsOf(report);
    await emailAdvancedPage.table.expectTotalsOf(report);
    await emailAdvancedPage.form.expectCollapsed();
  });

  test('offers the views the API configures', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();
    await emailAdvancedPage.openViaApi();

    const report = await emailAdvancedPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(apiOptions.tabs);
    expect(apiOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await emailAdvancedPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ emailAdvancedPage }) => {
      await emailAdvancedPage.open();
      await emailAdvancedPage.openViaApi();
      const opened = await emailAdvancedPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await emailAdvancedPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await emailAdvancedPage.table.expectActiveView(view);
      await emailAdvancedPage.table.expectColumnsOf(report);
      await emailAdvancedPage.table.expectRowsOf(report);
      await emailAdvancedPage.table.expectTotalsOf(report);
    });
  }

  test('lists the senders of API emails in the period', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();
    await emailAdvancedPage.openViaApi();

    const { params, offered, shown } = await emailAdvancedPage.form.listOptions('From Email');

    expect(params.get('field')).toBe('from_email');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    listed(shown, offered);
  });

  test('searches by tag and GUID', async ({ emailAdvancedPage }) => {
    await emailAdvancedPage.open();
    await emailAdvancedPage.openViaApi();
    await emailAdvancedPage.form.fill('Tags', 'automation');
    await emailAdvancedPage.form.fill('GUID', 'no-such-guid');

    const report = await emailAdvancedPage.form.search();

    expect(report.body.tag).toEqual({ key: 'equal', value: 'automation' });
    expect(report.body.guid).toEqual({ key: 'equal', value: 'no-such-guid' });
    await emailAdvancedPage.table.expectRowsOf(report);
    await emailAdvancedPage.table.expectTotalsOf(report);
  });
});
