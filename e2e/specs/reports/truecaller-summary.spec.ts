import { expect, test } from '../../fixtures/test-fixtures';
import { daysAgo, isoDate } from '../../utils/date-time';
import { viewsOf } from '../../utils/report-response';

// Read-only. The rows come from whatever Truecaller traffic the account has in the period, so
// tests pin down what each control asks the API for and compare the table with the response.
// Unlike the other channels, this report has no View Counts By choice: it always counts submissions.

// [view, group_by]. The first is the view each tab opens on. These are all the views known; an
// account is offered a subset.
const panelViews = [
  ['Campaign', 'campaign'],
  ['Date & Campaign', 'campaign_name'],
  ['Date', 'date'],
  ['Country', 'country'],
  ['TC Number', 'tc_number'],
  ['List Name', 'list_id'],
  ['Link Click', 'link_click'],
  ['Campaign Category', 'category'],
  ['Monthly', 'monthly'],
  ['Yearly', 'yearly'],
  ['Response', 'response'],
] as const;

const apiViews = [
  ['Date', 'date'],
  ['Country', 'country'],
  ['TC Number', 'tc_number'],
  ['Link Click', 'link_click'],
  ['Monthly', 'monthly'],
  ['Yearly', 'yearly'],
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

// The Filter By bar, as the panel's filter-option config lists them.
const panelFilters = ['Campaign Name', 'TC Number', 'List Name', 'Message Category'];

test.describe('Truecaller Summary via panel', () => {
  test('has a tab for each source of messages', async ({ truecallerSummaryPage }) => {
    await truecallerSummaryPage.open();

    await truecallerSummaryPage.expectTabs(['Via Panel', 'Via API']);
  });

  test('opens on campaign submissions for yesterday and today', async ({ truecallerSummaryPage }) => {
    const report = await truecallerSummaryPage.open();

    expect(report.params.get('group_by')).toBe('campaign');
    expect(report.params.get('view_counts_by')).toBe('submission');
    expect(report.params.get('filter_type')).toBe('custom');
    expect(report.params.get('page')).toBe('1');
    expect(report.params.get('limit')).toBe('10');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(1)), to_date: isoDate(daysAgo(0)) }]);
    await truecallerSummaryPage.table.expectActiveView('Campaign');
    await truecallerSummaryPage.filters.expectDateRange(daysAgo(1), daysAgo(0));
    await truecallerSummaryPage.table.expectColumnsOf(report);
    await truecallerSummaryPage.table.expectRowsOf(report);
    await truecallerSummaryPage.table.expectTotalsOf(report);
  });

  // Also guards the view list above: a view the API adds that the list doesn't know fails here.
  test('offers the views the API configures', async ({ truecallerSummaryPage }) => {
    const report = await truecallerSummaryPage.open();

    expect(report.viewByOptions.tabs).toEqual(panelOptions.tabs);
    expect(panelOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await truecallerSummaryPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ truecallerSummaryPage }) => {
      const opened = await truecallerSummaryPage.open();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await truecallerSummaryPage.table.viewBy(view);

      expect(report.params.get('group_by')).toBe(groupBy);
      await truecallerSummaryPage.table.expectActiveView(view);
      await truecallerSummaryPage.table.expectColumnsOf(report);
      await truecallerSummaryPage.table.expectRowsOf(report);
      await truecallerSummaryPage.table.expectTotalsOf(report);
    });
  }

  test('reports on a typed date range', async ({ truecallerSummaryPage }) => {
    await truecallerSummaryPage.open();

    const report = await truecallerSummaryPage.filters.setDateRange(daysAgo(10), daysAgo(3));

    expect(report.params.get('filter_type')).toBe('custom');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await truecallerSummaryPage.filters.expectDateRange(daysAgo(10), daysAgo(3));
  });

  test('reports on a whole month', async ({ truecallerSummaryPage }) => {
    const year = new Date().getFullYear();
    await truecallerSummaryPage.open();

    const report = await truecallerSummaryPage.filters.reportMonth('January', year);

    expect(report.params.get('filter_type')).toBe('monthly');
    expect(report.dateRange).toEqual([{ from_date: `${year}-01-01`, to_date: `${year}-01-31` }]);
    await truecallerSummaryPage.filters.expectMonthYearSelection('Month (1)');
  });

  test('reports on a whole year', async ({ truecallerSummaryPage }) => {
    const year = new Date().getFullYear();
    await truecallerSummaryPage.open();

    const report = await truecallerSummaryPage.filters.reportYear(year);

    expect(report.params.get('filter_type')).toBe('yearly');
    expect(report.dateRange).toEqual([{ from_date: `${year}-01-01`, to_date: `${year}-12-31` }]);
    await truecallerSummaryPage.filters.expectMonthYearSelection('Year (1)');
  });

  test('reloads from the first page when the page size changes', async ({ truecallerSummaryPage }) => {
    await truecallerSummaryPage.open();

    const report = await truecallerSummaryPage.table.setPageSize(25);

    expect(report.params.get('limit')).toBe('25');
    expect(report.params.get('page')).toBe('1');
  });

  test('offers a filter for each field the panel configures', async ({ truecallerSummaryPage }) => {
    await truecallerSummaryPage.open();

    await truecallerSummaryPage.filterBar.expectFilters(panelFilters);
  });

  test('narrows the report to one campaign and widens it again when cleared', async ({ truecallerSummaryPage }) => {
    const unfiltered = await truecallerSummaryPage.open();
    test.skip(unfiltered.docs.length === 0, 'No Truecaller campaigns ran yesterday or today.');
    const [campaign] = await truecallerSummaryPage.filterBar.options('Campaign Name');

    const filtered = await truecallerSummaryPage.filterBar.filterBy('Campaign Name', campaign);

    expect(filtered.params.get('campaign_name')).toBe(campaign);
    expect(filtered.params.get('group_by')).toBe('campaign');
    expect(filtered.docs.length).toBeGreaterThan(0);
    expect(filtered.docs.map((doc) => doc.campaign_name)).toEqual(filtered.docs.map(() => campaign));
    await truecallerSummaryPage.filterBar.expectFilterCount('Campaign Name', 1);
    await truecallerSummaryPage.table.expectRowsOf(filtered);

    const cleared = await truecallerSummaryPage.filterBar.clearFilter('Campaign Name');

    expect(cleared.params.has('campaign_name')).toBe(false);
    expect(cleared.total).toBe(unfiltered.total);
    await truecallerSummaryPage.filterBar.expectFilterClear('Campaign Name');
    await truecallerSummaryPage.table.expectRowsOf(cleared);
  });
});

test.describe('Truecaller Summary via API', () => {
  test('opens on API submissions by date', async ({ truecallerSummaryPage }) => {
    await truecallerSummaryPage.open();

    const report = await truecallerSummaryPage.openViaApi();

    expect(report.params.get('group_by')).toBe('date');
    expect(report.params.get('view_counts_by')).toBe('submission');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(1)), to_date: isoDate(daysAgo(0)) }]);
    await truecallerSummaryPage.table.expectActiveView('Date');
    await truecallerSummaryPage.table.expectColumnsOf(report);
    await truecallerSummaryPage.table.expectRowsOf(report);
    await truecallerSummaryPage.table.expectTotalsOf(report);
  });

  test('offers the views the API configures', async ({ truecallerSummaryPage }) => {
    await truecallerSummaryPage.open();
    const report = await truecallerSummaryPage.openViaApi();

    expect(report.viewByOptions.tabs).toEqual(apiOptions.tabs);
    expect(apiOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await truecallerSummaryPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ truecallerSummaryPage }) => {
      await truecallerSummaryPage.open();
      const opened = await truecallerSummaryPage.openViaApi();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await truecallerSummaryPage.table.viewBy(view);

      expect(report.params.get('group_by')).toBe(groupBy);
      await truecallerSummaryPage.table.expectActiveView(view);
      await truecallerSummaryPage.table.expectColumnsOf(report);
      await truecallerSummaryPage.table.expectRowsOf(report);
      await truecallerSummaryPage.table.expectTotalsOf(report);
    });
  }
});
