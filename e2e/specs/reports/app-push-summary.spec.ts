import { expect, test } from '../../fixtures/test-fixtures';
import { daysAgo, isoDate } from '../../utils/date-time';
import { viewsOf } from '../../utils/report-response';

// Read-only. App Push has only the Via Panel tab. The rows come from whatever the account pushed
// in the period, which is the App Push send spec's campaigns (APP_PUSH_SEND=1) and their test
// sends, so tests compare the table with the response and skip what needs traffic.

// [view, group_by]. The first is the view the report opens on.
const views = [
  ['Campaign', 'campaign'],
  ['Date & Campaign', 'campaign_name'],
  ['Date', 'date'],
  ['APP Name', 'app_name'],
  ['Service Provider', 'service_provider'],
  ['Device Type', 'device_type'],
  ['Campaign Category', 'category'],
  ['Monthly', 'monthly'],
  ['Yearly', 'yearly'],
] as const;

const options = {
  tabs: ['Date & Campaign', 'Date', 'Campaign'],
  more: views.slice(3).map(([view]) => view),
};

const filters = ['Campaign Name', 'App Name', 'Service Provider', 'Device Type'];

const countKeys = ['count_total', 'count_sent', 'count_delivered', 'count_failed', 'count_awaiting', 'count_rejected'];

// The message counts of a page of rows, added up per column.
function countsOf(docs: Record<string, unknown>[]): Record<string, number> {
  return Object.fromEntries(countKeys.map((key) => [key, docs.reduce((sum, doc) => sum + Number(doc[key] ?? 0), 0)]));
}

test.describe('App Push Summary', () => {
  test('opens from the side nav', async ({ page, sideNav }) => {
    await page.goto('/dashboard/home', { waitUntil: 'domcontentloaded' });

    await sideNav.open('Reports', 'APP Push', 'Summary');

    await expect(page).toHaveURL(/\/reports\/app-push\/summary\/via-panel$/);
  });

  test('opens on campaign message counts for yesterday and today', async ({ appPushSummaryPage }) => {
    const report = await appPushSummaryPage.open();

    expect(report.params.get('group_by')).toBe('campaign');
    expect(report.params.get('view_counts_by')).toBe('msg_splits');
    expect(report.params.get('filter_type')).toBe('custom');
    expect(report.params.get('page')).toBe('1');
    expect(report.params.get('limit')).toBe('10');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(1)), to_date: isoDate(daysAgo(0)) }]);
    await appPushSummaryPage.expectTabs(['Via Panel']);
    await appPushSummaryPage.table.expectActiveView('Campaign');
    await appPushSummaryPage.filters.expectDateRange(daysAgo(1), daysAgo(0));
    await appPushSummaryPage.table.expectColumnsOf(report);
    await appPushSummaryPage.table.expectRowsOf(report);
    await appPushSummaryPage.table.expectTotalsOf(report);
  });

  test('lists the campaigns the API returned', async ({ appPushSummaryPage }) => {
    const report = await appPushSummaryPage.open();
    test.skip(report.docs.length === 0, 'No App Push campaigns ran yesterday or today.');

    await appPushSummaryPage.table.expectFirstColumn(report.docs.map((doc) => String(doc.campaign_name)));
  });

  // Also guards the view list above: a view the API adds that the list doesn't know fails here.
  test('offers the views the API configures', async ({ appPushSummaryPage }) => {
    const report = await appPushSummaryPage.open();

    expect(report.viewByOptions.tabs).toEqual(options.tabs);
    expect(options.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await appPushSummaryPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of views.slice(1)) {
    test(`shows the ${view} view as the API returned it`, async ({ appPushSummaryPage }) => {
      const opened = await appPushSummaryPage.open();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await appPushSummaryPage.table.viewBy(view);

      expect(report.params.get('group_by')).toBe(groupBy);
      await appPushSummaryPage.table.expectActiveView(view);
      await appPushSummaryPage.table.expectColumnsOf(report);
      await appPushSummaryPage.table.expectRowsOf(report);
      await appPushSummaryPage.table.expectTotalsOf(report);
    });
  }

  // Every view counts the same messages, so its rows add up to the same counts.
  test('counts the same messages by date, device type and app', async ({ appPushSummaryPage }) => {
    const byCampaign = await appPushSummaryPage.open();
    test.skip(byCampaign.docs.length === 0, 'No App Push campaigns ran yesterday or today.');

    for (const view of ['Date', 'Device Type', 'APP Name']) {
      const report = await appPushSummaryPage.table.viewBy(view);

      expect(countsOf(report.docs), view).toEqual(countsOf(byCampaign.docs));
    }
  });

  // Known defect: the Service Provider view's rows carry no service_provider, so its first column
  // is blank, though every campaign went through an FCM app. This passes while the defect exists
  // and fails once it's fixed: then remove test.fail.
  test('names the provider in the Service Provider view', async ({ appPushSummaryPage }) => {
    const opened = await appPushSummaryPage.open();
    test.skip(opened.docs.length === 0, 'No App Push campaigns ran yesterday or today.');
    test.fail(true, 'Staging leaves service_provider out of the Service Provider view.');

    const report = await appPushSummaryPage.table.viewBy('Service Provider');

    expect(report.docs.map((doc) => doc.service_provider)).not.toContain(undefined);
  });

  test('reports on a typed date range', async ({ appPushSummaryPage }) => {
    await appPushSummaryPage.open();

    const report = await appPushSummaryPage.filters.setDateRange(daysAgo(10), daysAgo(3));

    expect(report.params.get('filter_type')).toBe('custom');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await appPushSummaryPage.filters.expectDateRange(daysAgo(10), daysAgo(3));
    await appPushSummaryPage.table.expectRowsOf(report);
  });

  test('reports on a whole month', async ({ appPushSummaryPage }) => {
    const year = new Date().getFullYear();
    await appPushSummaryPage.open();

    const report = await appPushSummaryPage.filters.reportMonth('January', year);

    expect(report.params.get('filter_type')).toBe('monthly');
    expect(report.dateRange).toEqual([{ from_date: `${year}-01-01`, to_date: `${year}-01-31` }]);
    await appPushSummaryPage.filters.expectMonthYearSelection('Month (1)');
    await appPushSummaryPage.table.expectRowsOf(report);
  });

  test('reports on a whole year', async ({ appPushSummaryPage }) => {
    const year = new Date().getFullYear();
    await appPushSummaryPage.open();

    const report = await appPushSummaryPage.filters.reportYear(year);

    expect(report.params.get('filter_type')).toBe('yearly');
    expect(report.dateRange).toEqual([{ from_date: `${year}-01-01`, to_date: `${year}-12-31` }]);
    await appPushSummaryPage.filters.expectMonthYearSelection('Year (1)');
    await appPushSummaryPage.table.expectRowsOf(report);
  });

  test('reloads from the first page when the page size changes', async ({ appPushSummaryPage }) => {
    await appPushSummaryPage.open();

    const report = await appPushSummaryPage.table.setPageSize(25);

    expect(report.params.get('limit')).toBe('25');
    expect(report.params.get('page')).toBe('1');
    await appPushSummaryPage.table.expectRowsOf(report);
  });

  test('offers a filter for each field the panel configures', async ({ appPushSummaryPage }) => {
    await appPushSummaryPage.open();

    await appPushSummaryPage.filterBar.expectFilters(filters);
  });

  for (const [filter, param] of [
    ['Campaign Name', 'campaign_name'],
    ['App Name', 'app_name'],
    ['Device Type', 'device_type'],
  ] as const) {
    test(`narrows the report by ${filter} and widens it again when cleared`, async ({ appPushSummaryPage }) => {
      const unfiltered = await appPushSummaryPage.open();
      test.skip(unfiltered.docs.length === 0, 'No App Push campaigns ran yesterday or today.');
      const [value] = await appPushSummaryPage.filterBar.options(filter);

      const filtered = await appPushSummaryPage.filterBar.filterBy(filter, value);

      expect(filtered.params.get(param)).toBe(value);
      expect(filtered.docs.length).toBeGreaterThan(0);
      await appPushSummaryPage.filterBar.expectFilterCount(filter, 1);
      await appPushSummaryPage.table.expectRowsOf(filtered);

      const cleared = await appPushSummaryPage.filterBar.clearFilter(filter);

      expect(cleared.params.has(param)).toBe(false);
      expect(cleared.total).toBe(unfiltered.total);
      await appPushSummaryPage.filterBar.expectFilterClear(filter);
    });
  }

  // Known defect: the Service Provider filter lists no providers though the period has FCM
  // traffic. This passes while the defect exists and fails once it's fixed: then remove test.fail.
  test('offers the providers that sent in the Service Provider filter', async ({ appPushSummaryPage }) => {
    const opened = await appPushSummaryPage.open();
    test.skip(opened.docs.length === 0, 'No App Push campaigns ran yesterday or today.');
    test.fail(true, 'Staging offers no Service Provider filter values.');

    expect(await appPushSummaryPage.filterBar.options('Service Provider')).not.toEqual([]);
  });
});
