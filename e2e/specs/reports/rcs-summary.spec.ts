import { expect, test } from '../../fixtures/test-fixtures';
import { daysAgo, isoDate } from '../../utils/date-time';
import { viewsOf } from '../../utils/report-response';

// Read-only. The rows come from whatever RCS traffic the account has in the period, so tests
// pin down what each control asks the API for and compare the table with the response.

// [view, group_by]. The first is the view each tab opens on. These are all the views known; an
// account is offered a subset.
const panelViews = [
  ['Campaign', 'campaign'],
  ['Date & Campaign', 'campaign_name'],
  ['Date', 'date'],
  ['Country', 'country'],
  ['List Name', 'list_id'],
  ['Agent Name', 'agent_name'],
  ['Responses', 'response'],
  ['Campaign Category', 'category'],
  ['Monthly', 'monthly'],
  ['Yearly', 'yearly'],
  ['Template Name', 'template_name'],
  ['Operator', 'operator'],
  ['Bot Type', 'agent_bot_type'],
] as const;

const apiViews = [
  ['Date', 'date'],
  ['Country', 'country'],
  ['Agent Name', 'agent_name'],
  ['Responses', 'response'],
  ['Template Name', 'template_name'],
  ['Operator', 'operator'],
  ['Bot Type', 'agent_bot_type'],
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
const panelFilters = ['Campaign Name', 'RBM Agent Name', 'List Name', 'Content Type'];

test.describe('RCS Summary via panel', () => {
  test('has a tab for each source of messages', async ({ rcsSummaryPage }) => {
    await rcsSummaryPage.open();
    const sources = ['Via Panel', 'Via API'];

    if (await rcsSummaryPage.hasIncomingMessages()) {
      sources.push('Incoming Messages');
    }

    await rcsSummaryPage.expectTabs(sources);
  });

  test('opens on campaign submissions for yesterday and today', async ({ rcsSummaryPage }) => {
    const report = await rcsSummaryPage.open();

    expect(report.params.get('group_by')).toBe('campaign');
    expect(report.params.get('view_counts_by')).toBe('submission');
    expect(report.params.get('filter_type')).toBe('custom');
    expect(report.params.get('page')).toBe('1');
    expect(report.params.get('limit')).toBe('10');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(1)), to_date: isoDate(daysAgo(0)) }]);
    await rcsSummaryPage.table.expectActiveView('Campaign');
    await rcsSummaryPage.filters.expectCountedBy('Submission');
    await rcsSummaryPage.filters.expectDateRange(daysAgo(1), daysAgo(0));
    await rcsSummaryPage.table.expectColumnsOf(report);
    await rcsSummaryPage.table.expectRowsOf(report);
    await rcsSummaryPage.table.expectTotalsOf(report);
  });

  // Also guards the view list above: a view the API adds that the list doesn't know fails here.
  test('offers the views the API configures', async ({ rcsSummaryPage }) => {
    const report = await rcsSummaryPage.open();

    expect(report.viewByOptions.tabs).toEqual(panelOptions.tabs);
    expect(panelOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await rcsSummaryPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ rcsSummaryPage }) => {
      const opened = await rcsSummaryPage.open();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await rcsSummaryPage.table.viewBy(view);

      expect(report.params.get('group_by')).toBe(groupBy);
      await rcsSummaryPage.table.expectActiveView(view);
      await rcsSummaryPage.table.expectColumnsOf(report);
      await rcsSummaryPage.table.expectRowsOf(report);
      await rcsSummaryPage.table.expectTotalsOf(report);
    });
  }

  test('counts billable messages when Billable is chosen', async ({ rcsSummaryPage }) => {
    await rcsSummaryPage.open();

    const report = await rcsSummaryPage.filters.countBy('Billable');

    expect(report.params.get('view_counts_by')).toBe('billable');
    expect(report.params.get('group_by')).toBe('campaign');
    await rcsSummaryPage.filters.expectCountedBy('Billable');
  });

  test('reports on a typed date range', async ({ rcsSummaryPage }) => {
    await rcsSummaryPage.open();

    const report = await rcsSummaryPage.filters.setDateRange(daysAgo(10), daysAgo(3));

    expect(report.params.get('filter_type')).toBe('custom');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await rcsSummaryPage.filters.expectDateRange(daysAgo(10), daysAgo(3));
  });

  test('reports on a whole month', async ({ rcsSummaryPage }) => {
    const year = new Date().getFullYear();
    await rcsSummaryPage.open();

    const report = await rcsSummaryPage.filters.reportMonth('January', year);

    expect(report.params.get('filter_type')).toBe('monthly');
    expect(report.dateRange).toEqual([{ from_date: `${year}-01-01`, to_date: `${year}-01-31` }]);
    await rcsSummaryPage.filters.expectMonthYearSelection('Month (1)');
  });

  test('reports on a whole year', async ({ rcsSummaryPage }) => {
    const year = new Date().getFullYear();
    await rcsSummaryPage.open();

    const report = await rcsSummaryPage.filters.reportYear(year);

    expect(report.params.get('filter_type')).toBe('yearly');
    expect(report.dateRange).toEqual([{ from_date: `${year}-01-01`, to_date: `${year}-12-31` }]);
    await rcsSummaryPage.filters.expectMonthYearSelection('Year (1)');
  });

  test('reloads from the first page when the page size changes', async ({ rcsSummaryPage }) => {
    await rcsSummaryPage.open();

    const report = await rcsSummaryPage.table.setPageSize(25);

    expect(report.params.get('limit')).toBe('25');
    expect(report.params.get('page')).toBe('1');
  });

  test('offers a filter for each field the panel configures', async ({ rcsSummaryPage }) => {
    await rcsSummaryPage.open();

    await rcsSummaryPage.filterBar.expectFilters(panelFilters);
  });

  test('narrows the report to one campaign and widens it again when cleared', async ({ rcsSummaryPage }) => {
    const unfiltered = await rcsSummaryPage.open();
    test.skip(unfiltered.docs.length === 0, 'No RCS campaigns ran yesterday or today.');
    const [campaign] = await rcsSummaryPage.filterBar.options('Campaign Name');

    const filtered = await rcsSummaryPage.filterBar.filterBy('Campaign Name', campaign);

    expect(filtered.params.get('campaign_name')).toBe(campaign);
    expect(filtered.params.get('group_by')).toBe('campaign');
    expect(filtered.docs.length).toBeGreaterThan(0);
    expect(filtered.docs.map((doc) => doc.campaign_name)).toEqual(filtered.docs.map(() => campaign));
    await rcsSummaryPage.filterBar.expectFilterCount('Campaign Name', 1);
    await rcsSummaryPage.table.expectRowsOf(filtered);

    const cleared = await rcsSummaryPage.filterBar.clearFilter('Campaign Name');

    expect(cleared.params.has('campaign_name')).toBe(false);
    expect(cleared.total).toBe(unfiltered.total);
    await rcsSummaryPage.filterBar.expectFilterClear('Campaign Name');
    await rcsSummaryPage.table.expectRowsOf(cleared);
  });
});

test.describe('RCS Summary via API', () => {
  test('opens on API submissions by date', async ({ rcsSummaryPage }) => {
    await rcsSummaryPage.open();

    const report = await rcsSummaryPage.openViaApi();

    expect(report.params.get('group_by')).toBe('date');
    expect(report.params.get('view_counts_by')).toBe('submission');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(1)), to_date: isoDate(daysAgo(0)) }]);
    await rcsSummaryPage.table.expectActiveView('Date');
    await rcsSummaryPage.table.expectColumnsOf(report);
    await rcsSummaryPage.table.expectRowsOf(report);
    await rcsSummaryPage.table.expectTotalsOf(report);
  });

  test('offers the views the API configures', async ({ rcsSummaryPage }) => {
    await rcsSummaryPage.open();
    const report = await rcsSummaryPage.openViaApi();

    expect(report.viewByOptions.tabs).toEqual(apiOptions.tabs);
    expect(apiOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await rcsSummaryPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ rcsSummaryPage }) => {
      await rcsSummaryPage.open();
      const opened = await rcsSummaryPage.openViaApi();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await rcsSummaryPage.table.viewBy(view);

      expect(report.params.get('group_by')).toBe(groupBy);
      await rcsSummaryPage.table.expectActiveView(view);
      await rcsSummaryPage.table.expectColumnsOf(report);
      await rcsSummaryPage.table.expectRowsOf(report);
      await rcsSummaryPage.table.expectTotalsOf(report);
    });
  }
});
