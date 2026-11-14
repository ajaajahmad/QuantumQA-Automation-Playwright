import { expect, test } from '../../fixtures/test-fixtures';
import { daysAgo, isoDate } from '../../utils/date-time';
import { viewsOf } from '../../utils/report-response';

// Read-only. The rows come from whatever email traffic the account has in the period, so tests
// pin down what each control asks the API for and compare the table with the response. This
// report has no View Counts By choice and sends no count parameter. The page is opened by URL
// because the Reports > Email side-nav link doesn't navigate on staging.

// [view, group_by]. The first is the view each tab opens on. These are all the views known; an
// account is offered a subset.
const panelViews = [
  ['Campaign', 'campaign'],
  ['Date & Campaign', 'campaign_name'],
  ['Date', 'date'],
  ['From Domain', 'from_domain'],
  ['Campaign Category', 'category'],
  ['Subject Line', 'subject'],
  ['Recipient Domain', 'recipient_domain'],
  ['Monthly', 'monthly'],
  ['Yearly', 'yearly'],
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

// The Filter By bar, as the panel's filter-option config lists them.
const panelFilters = ['Campaign Name', 'List Name', 'Domain'];

test.describe('Email Summary via panel', () => {
  test('has a tab for each source of messages', async ({ emailSummaryPage }) => {
    await emailSummaryPage.open();

    await emailSummaryPage.expectTabs(['Via Panel', 'Via API']);
  });

  test('opens on campaigns for yesterday and today', async ({ emailSummaryPage }) => {
    const report = await emailSummaryPage.open();

    expect(report.params.get('group_by')).toBe('campaign');
    expect(report.params.get('view_counts_by')).toBeNull();
    expect(report.params.get('filter_type')).toBe('custom');
    expect(report.params.get('page')).toBe('1');
    expect(report.params.get('limit')).toBe('10');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(1)), to_date: isoDate(daysAgo(0)) }]);
    await emailSummaryPage.table.expectActiveView('Campaign');
    await emailSummaryPage.filters.expectDateRange(daysAgo(1), daysAgo(0));
    await emailSummaryPage.table.expectColumnsOf(report);
    await emailSummaryPage.table.expectRowsOf(report);
    await emailSummaryPage.table.expectTotalsOf(report);
  });

  // Also guards the view list above: a view the API adds that the list doesn't know fails here.
  test('offers the views the API configures', async ({ emailSummaryPage }) => {
    const report = await emailSummaryPage.open();

    expect(report.viewByOptions.tabs).toEqual(panelOptions.tabs);
    expect(panelOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await emailSummaryPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ emailSummaryPage }) => {
      const opened = await emailSummaryPage.open();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await emailSummaryPage.table.viewBy(view);

      expect(report.params.get('group_by')).toBe(groupBy);
      await emailSummaryPage.table.expectActiveView(view);
      await emailSummaryPage.table.expectColumnsOf(report);
      await emailSummaryPage.table.expectRowsOf(report);
      await emailSummaryPage.table.expectTotalsOf(report);
    });
  }

  test('reports on a typed date range', async ({ emailSummaryPage }) => {
    await emailSummaryPage.open();

    const report = await emailSummaryPage.filters.setDateRange(daysAgo(10), daysAgo(3));

    expect(report.params.get('filter_type')).toBe('custom');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await emailSummaryPage.filters.expectDateRange(daysAgo(10), daysAgo(3));
  });

  test('reports on a whole month', async ({ emailSummaryPage }) => {
    const year = new Date().getFullYear();
    await emailSummaryPage.open();

    const report = await emailSummaryPage.filters.reportMonth('January', year);

    expect(report.params.get('filter_type')).toBe('monthly');
    expect(report.dateRange).toEqual([{ from_date: `${year}-01-01`, to_date: `${year}-01-31` }]);
    await emailSummaryPage.filters.expectMonthYearSelection('Month (1)');
  });

  test('reports on a whole year', async ({ emailSummaryPage }) => {
    const year = new Date().getFullYear();
    await emailSummaryPage.open();

    const report = await emailSummaryPage.filters.reportYear(year);

    expect(report.params.get('filter_type')).toBe('yearly');
    expect(report.dateRange).toEqual([{ from_date: `${year}-01-01`, to_date: `${year}-12-31` }]);
    await emailSummaryPage.filters.expectMonthYearSelection('Year (1)');
  });

  test('reloads from the first page when the page size changes', async ({ emailSummaryPage }) => {
    await emailSummaryPage.open();

    const report = await emailSummaryPage.table.setPageSize(25);

    expect(report.params.get('limit')).toBe('25');
    expect(report.params.get('page')).toBe('1');
  });

  test('offers a filter for each field the panel configures', async ({ emailSummaryPage }) => {
    await emailSummaryPage.open();

    await emailSummaryPage.filterBar.expectFilters(panelFilters);
  });

  test('narrows the report to one campaign and widens it again when cleared', async ({ emailSummaryPage }) => {
    const unfiltered = await emailSummaryPage.open();
    test.skip(unfiltered.docs.length === 0, 'No email campaigns ran yesterday or today.');
    const [campaign] = await emailSummaryPage.filterBar.options('Campaign Name');

    const filtered = await emailSummaryPage.filterBar.filterBy('Campaign Name', campaign);

    expect(filtered.params.get('campaign_name')).toBe(campaign);
    expect(filtered.params.get('group_by')).toBe('campaign');
    expect(filtered.docs.length).toBeGreaterThan(0);
    expect(filtered.docs.map((doc) => doc.campaign_name)).toEqual(filtered.docs.map(() => campaign));
    await emailSummaryPage.filterBar.expectFilterCount('Campaign Name', 1);
    await emailSummaryPage.table.expectRowsOf(filtered);

    const cleared = await emailSummaryPage.filterBar.clearFilter('Campaign Name');

    expect(cleared.params.has('campaign_name')).toBe(false);
    expect(cleared.total).toBe(unfiltered.total);
    await emailSummaryPage.filterBar.expectFilterClear('Campaign Name');
    await emailSummaryPage.table.expectRowsOf(cleared);
  });
});

test.describe('Email Summary via API', () => {
  test('opens on API emails by date', async ({ emailSummaryPage }) => {
    await emailSummaryPage.open();

    const report = await emailSummaryPage.openViaApi();

    expect(report.params.get('group_by')).toBe('date');
    expect(report.params.get('view_counts_by')).toBeNull();
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(1)), to_date: isoDate(daysAgo(0)) }]);
    await emailSummaryPage.table.expectActiveView('Date');
    await emailSummaryPage.table.expectColumnsOf(report);
    await emailSummaryPage.table.expectRowsOf(report);
    await emailSummaryPage.table.expectTotalsOf(report);
  });

  test('offers the views the API configures', async ({ emailSummaryPage }) => {
    await emailSummaryPage.open();
    const report = await emailSummaryPage.openViaApi();

    expect(report.viewByOptions.tabs).toEqual(apiOptions.tabs);
    expect(apiOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await emailSummaryPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ emailSummaryPage }) => {
      await emailSummaryPage.open();
      const opened = await emailSummaryPage.openViaApi();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await emailSummaryPage.table.viewBy(view);

      expect(report.params.get('group_by')).toBe(groupBy);
      await emailSummaryPage.table.expectActiveView(view);
      await emailSummaryPage.table.expectColumnsOf(report);
      await emailSummaryPage.table.expectRowsOf(report);
      await emailSummaryPage.table.expectTotalsOf(report);
    });
  }
});
