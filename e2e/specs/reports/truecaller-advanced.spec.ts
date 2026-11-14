import { expect, test } from '../../fixtures/test-fixtures';
import { daysAgo, isoDate } from '../../utils/date-time';
import { viewsOf } from '../../utils/report-response';

// Read-only. Nothing loads until Search is clicked, so each test pins down what the form posts
// and that the results are built from the response. The filters offer whatever the account has
// in the period, so tests pick values from those lists instead of naming campaigns. Unlike the
// other channels, this form has no Mobile Number field and no View Counts By choice.

// [view, group_by]. The first is the view a search opens on. Monthly and Yearly are summary-only.
// These are all the views known; an account is offered a subset.
const panelViews = [
  ['Campaign', 'campaign'],
  ['Date & Campaign', 'campaign_name'],
  ['Date', 'date'],
  ['Country', 'country'],
  ['TC Number', 'tc_number'],
  ['List Name', 'list_id'],
  ['Link Click', 'link_click'],
  ['Campaign Category', 'category'],
  ['Response', 'response'],
] as const;

const apiViews = [
  ['Date', 'date'],
  ['Country', 'country'],
  ['TC Number', 'tc_number'],
  ['Link Click', 'link_click'],
  ['Response', 'response'],
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
  'Campaign Category',
  'List Name',
  'Status',
  'Country',
  'Message Category',
  'Content Type',
  'Executed By',
];

const apiFields = [
  'Start Date',
  'End Date',
  'Sender ID',
  'Tags',
  'GUID',
  'Content Type',
  'Message Category',
  'Country',
  'Status',
];

const defaultSearch = {
  from_date: isoDate(daysAgo(1)),
  to_date: isoDate(daysAgo(0)),
  view_counts_by: 'submission',
  limit: 10,
  page: 1,
};

test.describe('Truecaller Advanced Search via panel', () => {
  test('opens on yesterday to today with nothing searched yet', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();

    await truecallerAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
    await truecallerAdvancedPage.form.expectFields(panelFields);
    await truecallerAdvancedPage.expectNoResults();
  });

  test('searches campaign submissions for the dates and collapses the form', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();

    const report = await truecallerAdvancedPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'campaign' });
    await truecallerAdvancedPage.table.expectActiveView('Campaign');
    await truecallerAdvancedPage.table.expectColumnsOf(report);
    await truecallerAdvancedPage.table.expectRowsOf(report);
    await truecallerAdvancedPage.table.expectTotalsOf(report);
    await truecallerAdvancedPage.form.expectCollapsed();

    await truecallerAdvancedPage.form.expand();
    await truecallerAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
  });

  // Also guards the view list above: a view the API adds that the list doesn't know fails here.
  test('offers the views the API configures', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();

    const report = await truecallerAdvancedPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(panelOptions.tabs);
    expect(panelOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await truecallerAdvancedPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ truecallerAdvancedPage }) => {
      await truecallerAdvancedPage.open();
      const opened = await truecallerAdvancedPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await truecallerAdvancedPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await truecallerAdvancedPage.table.expectActiveView(view);
      await truecallerAdvancedPage.table.expectColumnsOf(report);
      await truecallerAdvancedPage.table.expectRowsOf(report);
      await truecallerAdvancedPage.table.expectTotalsOf(report);
    });
  }

  test('searches a typed date range', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();
    await truecallerAdvancedPage.form.setDates(daysAgo(10), daysAgo(3));

    const report = await truecallerAdvancedPage.form.search();

    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await truecallerAdvancedPage.form.expectDates(daysAgo(10), daysAgo(3));
  });

  test('lists the campaigns the account ran in the period', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();

    const { params, offered, shown } = await truecallerAdvancedPage.form.listOptions('Campaign Name');

    expect(params.get('field')).toBe('campaign_name');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('lists the delivery statuses with All first', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();

    const { params, offered, shown } = await truecallerAdvancedPage.form.listOptions('Status');

    expect(params.get('field')).toBe('status');
    expect(offered[0]).toBe('All');
    expect(shown).toEqual(offered);
  });

  test('searches one campaign picked from the list', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();
    const [campaign] = (await truecallerAdvancedPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No Truecaller campaigns ran yesterday or today.');
    await truecallerAdvancedPage.form.select('Campaign Name', campaign);

    const report = await truecallerAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'select', value: campaign });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.campaign_name)).toEqual(report.docs.map(() => campaign));
    await truecallerAdvancedPage.table.expectRowsOf(report);
  });

  test('searches campaigns whose name contains text', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();
    const [campaign] = (await truecallerAdvancedPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No Truecaller campaigns ran yesterday or today.');
    const part = campaign.slice(0, 9);
    await truecallerAdvancedPage.form.contains('Campaign Name', part);

    const report = await truecallerAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'contains', value: part });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.every((doc) => String(doc.campaign_name).includes(part))).toBe(true);
    await truecallerAdvancedPage.table.expectRowsOf(report);
  });

  test('leaves out campaigns whose name contains text', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();
    const [campaign] = (await truecallerAdvancedPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No Truecaller campaigns ran yesterday or today.');
    const part = campaign.slice(0, 9);
    await truecallerAdvancedPage.form.doesNotContain('Campaign Name', part);

    const report = await truecallerAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'not_contains', value: part });
    expect(report.docs.some((doc) => String(doc.campaign_name).includes(part))).toBe(false);
    await truecallerAdvancedPage.table.expectRowsOf(report);
  });

  test('searches one delivery status', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();
    await truecallerAdvancedPage.form.select('Status', 'Delivered');

    const report = await truecallerAdvancedPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await truecallerAdvancedPage.table.expectRowsOf(report);
  });

  test('keeps the filters when the view changes', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();
    await truecallerAdvancedPage.form.select('Status', 'Delivered');
    await truecallerAdvancedPage.form.search();

    const report = await truecallerAdvancedPage.table.viewBy('Date');

    expect(report.body.group_by).toBe('date');
    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
  });

  test('reloads from the first page when the page size changes', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();
    await truecallerAdvancedPage.form.search();

    const report = await truecallerAdvancedPage.table.setPageSize(25);

    // The page posts the chosen size as a string, unlike the number it posts on Search.
    expect(Number(report.body.limit)).toBe(25);
    expect(report.body.page).toBe(1);
  });
});

test.describe('Truecaller Advanced Search via API', () => {
  test('opens on yesterday to today with the API fields', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();
    await truecallerAdvancedPage.openViaApi();

    await truecallerAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
    await truecallerAdvancedPage.form.expectFields(apiFields);
    await truecallerAdvancedPage.expectNoResults();
  });

  test('searches API submissions by date', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();
    await truecallerAdvancedPage.openViaApi();

    const report = await truecallerAdvancedPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'date' });
    await truecallerAdvancedPage.table.expectActiveView('Date');
    await truecallerAdvancedPage.table.expectColumnsOf(report);
    await truecallerAdvancedPage.table.expectRowsOf(report);
    await truecallerAdvancedPage.table.expectTotalsOf(report);
    await truecallerAdvancedPage.form.expectCollapsed();
  });

  test('offers the views the API configures', async ({ truecallerAdvancedPage }) => {
    await truecallerAdvancedPage.open();
    await truecallerAdvancedPage.openViaApi();

    const report = await truecallerAdvancedPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(apiOptions.tabs);
    expect(apiOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await truecallerAdvancedPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ truecallerAdvancedPage }) => {
      await truecallerAdvancedPage.open();
      await truecallerAdvancedPage.openViaApi();
      const opened = await truecallerAdvancedPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await truecallerAdvancedPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await truecallerAdvancedPage.table.expectActiveView(view);
      await truecallerAdvancedPage.table.expectColumnsOf(report);
      await truecallerAdvancedPage.table.expectRowsOf(report);
      await truecallerAdvancedPage.table.expectTotalsOf(report);
    });
  }

  test('lists the sender IDs that sent API messages in the period', async ({ truecallerAdvancedPage }) => {
    // Staging defect: the Via API lists answer 500 for every field except Status.
    test.fail(true, 'the Via API option lists fail on staging');
    await truecallerAdvancedPage.open();
    await truecallerAdvancedPage.openViaApi();

    const { params, offered, shown } = await truecallerAdvancedPage.form.listOptions('Sender ID');

    expect(params.get('field')).toBe('tc_number');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('searches by tag and GUID', async ({ truecallerAdvancedPage }) => {
    // Staging defect: a tag or GUID filter, alone or together, answers 503 "Something went wrong".
    test.fail(true, 'the Via API search fails on staging when filtered by tag or GUID');
    await truecallerAdvancedPage.open();
    await truecallerAdvancedPage.openViaApi();
    await truecallerAdvancedPage.form.fill('Tags', 'automation');
    await truecallerAdvancedPage.form.fill('GUID', 'no-such-guid');

    const report = await truecallerAdvancedPage.form.search();

    expect(report.body.tag).toEqual({ key: 'equal', value: 'automation' });
    expect(report.body.guid).toEqual({ key: 'equal', value: 'no-such-guid' });
    await truecallerAdvancedPage.table.expectRowsOf(report);
    await truecallerAdvancedPage.table.expectTotalsOf(report);
  });
});
