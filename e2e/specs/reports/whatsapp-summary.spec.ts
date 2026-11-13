import { expect, test } from '../../fixtures/test-fixtures';
import { daysAgo, isoDate } from '../../utils/date-time';

// Read-only. The account has no WhatsApp traffic yet, so these pin down what each control asks
// the API for and that the table is built from the response, not the numbers in it.

// [view, group_by]. The first is the view each tab opens on.
const panelViews = [
  ['Campaign', 'campaign'],
  ['Date & Campaign', 'campaign_name'],
  ['Date', 'date'],
  ['Country', 'country'],
  ['WABA Number', 'waba_number'],
  ['Template Name', 'template_name'],
  ['Failure Reasons', 'failure_reason'],
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
  ['Failure Reasons', 'failure_reason'],
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

test.describe('WhatsApp Summary via panel', () => {
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
    await whatsAppSummaryPage.table.expectRecordsOf(report);
  });

  // Also guards the view list below: a view the API adds or drops fails here first.
  test('offers the views the API configures', async ({ whatsAppSummaryPage }) => {
    const report = await whatsAppSummaryPage.open();

    expect(report.viewByOptions).toEqual(panelOptions);
    await whatsAppSummaryPage.table.expectViewByOptions(panelOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ whatsAppSummaryPage }) => {
      await whatsAppSummaryPage.open();

      const report = await whatsAppSummaryPage.table.viewBy(view);

      expect(report.params.get('group_by')).toBe(groupBy);
      await whatsAppSummaryPage.table.expectActiveView(view);
      await whatsAppSummaryPage.table.expectColumnsOf(report);
      await whatsAppSummaryPage.table.expectRecordsOf(report);
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
    await whatsAppSummaryPage.table.expectRecordsOf(report);
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
      await whatsAppSummaryPage.table.expectRecordsOf(report);
    });
  }
});
