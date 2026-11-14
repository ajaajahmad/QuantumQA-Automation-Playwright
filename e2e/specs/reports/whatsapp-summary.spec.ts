import { expect, test } from '../../fixtures/test-fixtures';
import { daysAgo, isoDate } from '../../utils/date-time';

// Read-only. The rows come from whatever WhatsApp traffic the account has in the period, so tests
// pin down what each control asks the API for and compare the table with the response.

// [view, group_by]. The first is the view each tab opens on.
const panelViews = [
  ['Campaign', 'campaign'],
  ['Date & Campaign', 'campaign_name'],
  ['Date', 'date'],
  ['Country', 'country'],
  ['WABA Number', 'waba_number'],
  ['Template Name', 'template_name'],
  ['List Name', 'list_id'],
  ['Responses', 'link_click'],
  ['Campaign Category', 'category'],
  ['Campaign Type', 'is_direct_send'],
  ['Monthly', 'monthly'],
  ['Yearly', 'yearly'],
] as const;

const apiViews = [
  ['Date', 'date'],
  ['Country', 'country'],
  ['WABA Number', 'waba_number'],
  ['Template Name', 'template_name'],
  ['Campaign Type', 'is_direct_send'],
  ['Responses', 'link_click'],
  ['Monthly', 'monthly'],
  ['Yearly', 'yearly'],
] as const;

const panelOptions = {
  tabs: ['Date & Campaign', 'Date', 'Campaign'],
  more: panelViews.slice(3).map(([view]) => view),
};

const apiOptions = {
  tabs: ['Date'],
  more: apiViews.slice(1).map(([view]) => view),
};

const incomingViews = [
  ['Date', 'date'],
  ['Date & Waba Number', 'waba_number_date'],
  ['Waba Number', 'waba_number'],
] as const;

const incomingOptions = {
  tabs: ['Date & Waba Number', 'Date', 'Waba Number'],
  more: [],
};

// The Filter By bar, as the panel's filter-option config lists them.
const panelFilters = ['Campaign Name', 'WABA Number', 'List Name', 'Template Category', 'Type'];

test.describe('WhatsApp Summary via panel', () => {
  test('has a tab for each source of messages', async ({ whatsAppSummaryPage }) => {
    await whatsAppSummaryPage.open();

    await whatsAppSummaryPage.expectTabs(['Via Panel', 'Via API', 'Incoming Messages']);
  });

  test('opens on campaign submissions for yesterday and today', async ({ whatsAppSummaryPage }) => {
    const report = await whatsAppSummaryPage.open();

    expect(report.params.get('group_by')).toBe('campaign');
    expect(report.params.get('view_counts_by')).toBe('submission');
    expect(report.params.get('filter_type')).toBe('custom');
    expect(report.params.get('page')).toBe('1');
    expect(report.params.get('limit')).toBe('10');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(1)), to_date: isoDate(daysAgo(0)) }]);
    await whatsAppSummaryPage.table.expectActiveView('Campaign');
    await whatsAppSummaryPage.filters.expectCountedBy('Submission');
    await whatsAppSummaryPage.filters.expectDateRange(daysAgo(1), daysAgo(0));
    await whatsAppSummaryPage.table.expectColumnsOf(report);
    await whatsAppSummaryPage.table.expectRowsOf(report);
    await whatsAppSummaryPage.table.expectTotalsOf(report);
  });

  // Also guards the view list below: a view the API adds or drops fails here first.
  test('offers the views the API configures', async ({ whatsAppSummaryPage }) => {
    const report = await whatsAppSummaryPage.open();

    expect(report.viewByOptions).toEqual(panelOptions);
    await whatsAppSummaryPage.table.expectViewByOptions(panelOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ whatsAppSummaryPage }) => {
      // Staging defect: with traffic in the period this view answers 503 "Something went wrong".
      test.fail(view === 'Campaign Type', 'the Campaign Type view fails on staging once the period has traffic');
      await whatsAppSummaryPage.open();

      const report = await whatsAppSummaryPage.table.viewBy(view);

      expect(report.params.get('group_by')).toBe(groupBy);
      await whatsAppSummaryPage.table.expectActiveView(view);
      await whatsAppSummaryPage.table.expectColumnsOf(report);
      await whatsAppSummaryPage.table.expectRowsOf(report);
      await whatsAppSummaryPage.table.expectTotalsOf(report);
    });
  }

  test('counts billable messages when Billable is chosen', async ({ whatsAppSummaryPage }) => {
    await whatsAppSummaryPage.open();

    const report = await whatsAppSummaryPage.filters.countBy('Billable');

    expect(report.params.get('view_counts_by')).toBe('billable');
    expect(report.params.get('group_by')).toBe('campaign');
    await whatsAppSummaryPage.filters.expectCountedBy('Billable');
  });

  test('reports on a typed date range', async ({ whatsAppSummaryPage }) => {
    await whatsAppSummaryPage.open();

    const report = await whatsAppSummaryPage.filters.setDateRange(daysAgo(10), daysAgo(3));

    expect(report.params.get('filter_type')).toBe('custom');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await whatsAppSummaryPage.filters.expectDateRange(daysAgo(10), daysAgo(3));
  });

  test('reports on a whole month', async ({ whatsAppSummaryPage }) => {
    const year = new Date().getFullYear();
    await whatsAppSummaryPage.open();

    const report = await whatsAppSummaryPage.filters.reportMonth('January', year);

    expect(report.params.get('filter_type')).toBe('monthly');
    expect(report.dateRange).toEqual([{ from_date: `${year}-01-01`, to_date: `${year}-01-31` }]);
    await whatsAppSummaryPage.filters.expectMonthYearSelection('Month (1)');
  });

  test('reports on a whole year', async ({ whatsAppSummaryPage }) => {
    const year = new Date().getFullYear();
    await whatsAppSummaryPage.open();

    const report = await whatsAppSummaryPage.filters.reportYear(year);

    expect(report.params.get('filter_type')).toBe('yearly');
    expect(report.dateRange).toEqual([{ from_date: `${year}-01-01`, to_date: `${year}-12-31` }]);
    await whatsAppSummaryPage.filters.expectMonthYearSelection('Year (1)');
  });

  test('reloads from the first page when the page size changes', async ({ whatsAppSummaryPage }) => {
    await whatsAppSummaryPage.open();

    const report = await whatsAppSummaryPage.table.setPageSize(25);

    expect(report.params.get('limit')).toBe('25');
    expect(report.params.get('page')).toBe('1');
  });

  test('offers a filter for each field the panel configures', async ({ whatsAppSummaryPage }) => {
    await whatsAppSummaryPage.open();

    await whatsAppSummaryPage.filterBar.expectFilters(panelFilters);
  });

  test('narrows the report to one campaign and widens it again when cleared', async ({ whatsAppSummaryPage }) => {
    const unfiltered = await whatsAppSummaryPage.open();
    const [campaign] = await whatsAppSummaryPage.filterBar.options('Campaign Name');

    const filtered = await whatsAppSummaryPage.filterBar.filterBy('Campaign Name', campaign);

    expect(filtered.params.get('campaign_name')).toBe(campaign);
    expect(filtered.params.get('group_by')).toBe('campaign');
    expect(filtered.docs.length).toBeGreaterThan(0);
    expect(filtered.docs.map((doc) => doc.campaign_name)).toEqual(filtered.docs.map(() => campaign));
    await whatsAppSummaryPage.filterBar.expectFilterCount('Campaign Name', 1);
    await whatsAppSummaryPage.table.expectRowsOf(filtered);

    const cleared = await whatsAppSummaryPage.filterBar.clearFilter('Campaign Name');

    expect(cleared.params.has('campaign_name')).toBe(false);
    expect(cleared.total).toBe(unfiltered.total);
    await whatsAppSummaryPage.filterBar.expectFilterClear('Campaign Name');
    await whatsAppSummaryPage.table.expectRowsOf(cleared);
  });
});

test.describe('WhatsApp Summary via API', () => {
  test('opens on API submissions by date', async ({ whatsAppSummaryPage }) => {
    await whatsAppSummaryPage.open();

    const report = await whatsAppSummaryPage.openViaApi();

    expect(report.params.get('group_by')).toBe('date');
    expect(report.params.get('view_counts_by')).toBe('submission');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(1)), to_date: isoDate(daysAgo(0)) }]);
    await whatsAppSummaryPage.table.expectActiveView('Date');
    await whatsAppSummaryPage.table.expectColumnsOf(report);
    await whatsAppSummaryPage.table.expectRowsOf(report);
    await whatsAppSummaryPage.table.expectTotalsOf(report);
  });

  test('offers the views the API configures', async ({ whatsAppSummaryPage }) => {
    await whatsAppSummaryPage.open();
    const report = await whatsAppSummaryPage.openViaApi();

    expect(report.viewByOptions).toEqual(apiOptions);
    await whatsAppSummaryPage.table.expectViewByOptions(apiOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ whatsAppSummaryPage }) => {
      await whatsAppSummaryPage.open();
      await whatsAppSummaryPage.openViaApi();

      const report = await whatsAppSummaryPage.table.viewBy(view);

      expect(report.params.get('group_by')).toBe(groupBy);
      await whatsAppSummaryPage.table.expectActiveView(view);
      await whatsAppSummaryPage.table.expectColumnsOf(report);
      await whatsAppSummaryPage.table.expectRowsOf(report);
      await whatsAppSummaryPage.table.expectTotalsOf(report);
    });
  }
});

test.describe('WhatsApp Summary incoming messages', () => {
  test('opens on text replies by date for yesterday and today', async ({ whatsAppSummaryPage }) => {
    await whatsAppSummaryPage.open();

    const report = await whatsAppSummaryPage.openIncomingMessages();

    expect(report.params.get('group_by')).toBe('date');
    expect(report.params.get('response_type')).toBe('text');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(1)), to_date: isoDate(daysAgo(0)) }]);
    await whatsAppSummaryPage.table.expectActiveView('Date');
    await whatsAppSummaryPage.filters.expectDateRange(daysAgo(1), daysAgo(0));
    await whatsAppSummaryPage.table.expectColumnsOf(report);
    await whatsAppSummaryPage.table.expectRowsOf(report);
    await whatsAppSummaryPage.table.expectTotalsOf(report);
  });

  test('offers the views the API configures', async ({ whatsAppSummaryPage }) => {
    await whatsAppSummaryPage.open();
    const report = await whatsAppSummaryPage.openIncomingMessages();

    expect(report.viewByOptions).toEqual(incomingOptions);
    await whatsAppSummaryPage.table.expectViewByOptions(incomingOptions);
  });

  for (const [view, groupBy] of incomingViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ whatsAppSummaryPage }) => {
      await whatsAppSummaryPage.open();
      await whatsAppSummaryPage.openIncomingMessages();

      const report = await whatsAppSummaryPage.table.viewBy(view);

      expect(report.params.get('group_by')).toBe(groupBy);
      await whatsAppSummaryPage.table.expectActiveView(view);
      await whatsAppSummaryPage.table.expectColumnsOf(report);
      await whatsAppSummaryPage.table.expectRowsOf(report);
      await whatsAppSummaryPage.table.expectTotalsOf(report);
    });
  }

  test('reports on a typed date range', async ({ whatsAppSummaryPage }) => {
    await whatsAppSummaryPage.open();
    await whatsAppSummaryPage.openIncomingMessages();

    const report = await whatsAppSummaryPage.filters.setDateRange(daysAgo(10), daysAgo(3));

    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await whatsAppSummaryPage.filters.expectDateRange(daysAgo(10), daysAgo(3));
  });
});
