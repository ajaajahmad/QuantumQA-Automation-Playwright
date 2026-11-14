import { expect, test } from '../../fixtures/test-fixtures';
import { daysAgo, isoDate } from '../../utils/date-time';

// Read-only. The rows come from whatever SMS traffic the account has in the period, mostly the
// campaigns the SMS campaign spec sends, so tests compare the table with the response. The page
// is opened by URL because the Reports > SMS side-nav link doesn't navigate on staging.

// [view, group_by]. The first is the view each tab opens on.
const panelViews = [
  ['Campaign', 'campaign'],
  ['Date & Campaign', 'campaign_name'],
  ['Date', 'date'],
  ['Country', 'country'],
  ['Sender ID', 'sender_id'],
  ['Operator', 'operator'],
  ['List Name', 'list_id'],
  ['Link Click', 'link_click'],
  ['Template ID', 'dlt_template_id'],
  ['Template Name', 'template_name'],
  ['Campaign Category', 'category'],
  ['Monthly', 'monthly'],
  ['Yearly', 'yearly'],
] as const;

const apiViews = [
  ['Date', 'date'],
  ['Sender ID', 'sender_id'],
  ['Operator', 'operator'],
  ['Country', 'country'],
  ['Template ID', 'dlt_template_id'],
  ['Template Name', 'template_name'],
  ['Monthly', 'monthly'],
  ['Yearly', 'yearly'],
] as const;

const panelOptions = {
  tabs: ['Date & Campaign', 'Date', 'Campaign'],
  more: panelViews.slice(3).map(([view]) => view),
};

const apiOptions = {
  tabs: ['Date', 'Sender ID', 'Operator'],
  more: apiViews.slice(3).map(([view]) => view),
};

test.describe('SMS Summary via panel', () => {
  test('opens on campaign message counts for yesterday and today', async ({ smsSummaryPage }) => {
    const report = await smsSummaryPage.open();

    expect(report.params.get('group_by')).toBe('campaign');
    expect(report.params.get('view_counts_by')).toBe('msg_splits');
    expect(report.params.get('filter_type')).toBe('custom');
    expect(report.params.get('page')).toBe('1');
    expect(report.params.get('limit')).toBe('10');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(1)), to_date: isoDate(daysAgo(0)) }]);
    await smsSummaryPage.table.expectActiveView('Campaign');
    await smsSummaryPage.filters.expectCountedBy('No. of messages');
    await smsSummaryPage.filters.expectDateRange(daysAgo(1), daysAgo(0));
    await smsSummaryPage.table.expectColumnsOf(report);
    await smsSummaryPage.table.expectRecordsOf(report);
  });

  test('lists the campaigns the API returned', async ({ smsSummaryPage }) => {
    const report = await smsSummaryPage.open();
    test.skip(report.docs.length === 0, 'No SMS campaigns ran yesterday or today.');

    await smsSummaryPage.table.expectFirstColumn(report.docs.map((doc) => String(doc.campaign_name)));
  });

  // Also guards the view list below: a view the API adds or drops fails here first.
  test('offers the views the API configures', async ({ smsSummaryPage }) => {
    const report = await smsSummaryPage.open();

    expect(report.viewByOptions).toEqual(panelOptions);
    await smsSummaryPage.table.expectViewByOptions(panelOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view as the API returned it`, async ({ smsSummaryPage }) => {
      await smsSummaryPage.open();

      const report = await smsSummaryPage.table.viewBy(view);

      expect(report.params.get('group_by')).toBe(groupBy);
      await smsSummaryPage.table.expectActiveView(view);
      await smsSummaryPage.table.expectColumnsOf(report);
      await smsSummaryPage.table.expectRecordsOf(report);
    });
  }

  test('counts recipients when No. of recipients is chosen', async ({ smsSummaryPage }) => {
    await smsSummaryPage.open();

    const report = await smsSummaryPage.filters.countBy('No. of recipients');

    expect(report.params.get('view_counts_by')).toBe('number');
    expect(report.params.get('group_by')).toBe('campaign');
    await smsSummaryPage.filters.expectCountedBy('No. of recipients');
    await smsSummaryPage.table.expectRecordsOf(report);
  });

  test('reports on a typed date range', async ({ smsSummaryPage }) => {
    await smsSummaryPage.open();

    const report = await smsSummaryPage.filters.setDateRange(daysAgo(10), daysAgo(3));

    expect(report.params.get('filter_type')).toBe('custom');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await smsSummaryPage.filters.expectDateRange(daysAgo(10), daysAgo(3));
    await smsSummaryPage.table.expectRecordsOf(report);
  });

  test('reports on a whole month', async ({ smsSummaryPage }) => {
    const year = new Date().getFullYear();
    await smsSummaryPage.open();

    const report = await smsSummaryPage.filters.reportMonth('January', year);

    expect(report.params.get('filter_type')).toBe('monthly');
    expect(report.dateRange).toEqual([{ from_date: `${year}-01-01`, to_date: `${year}-01-31` }]);
    await smsSummaryPage.filters.expectMonthYearSelection('Month (1)');
    await smsSummaryPage.table.expectRecordsOf(report);
  });

  test('reports on a whole year', async ({ smsSummaryPage }) => {
    const year = new Date().getFullYear();
    await smsSummaryPage.open();

    const report = await smsSummaryPage.filters.reportYear(year);

    expect(report.params.get('filter_type')).toBe('yearly');
    expect(report.dateRange).toEqual([{ from_date: `${year}-01-01`, to_date: `${year}-12-31` }]);
    await smsSummaryPage.filters.expectMonthYearSelection('Year (1)');
    await smsSummaryPage.table.expectRecordsOf(report);
  });

  test('reloads from the first page when the page size changes', async ({ smsSummaryPage }) => {
    await smsSummaryPage.open();

    const report = await smsSummaryPage.table.setPageSize(25);

    expect(report.params.get('limit')).toBe('25');
    expect(report.params.get('page')).toBe('1');
    await smsSummaryPage.table.expectRecordsOf(report);
  });
});

test.describe('SMS Summary via API', () => {
  test('opens on API message counts by date', async ({ smsSummaryPage }) => {
    await smsSummaryPage.open();

    const report = await smsSummaryPage.openViaApi();

    expect(report.params.get('group_by')).toBe('date');
    expect(report.params.get('view_counts_by')).toBe('msg_splits');
    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(1)), to_date: isoDate(daysAgo(0)) }]);
    await smsSummaryPage.table.expectActiveView('Date');
    await smsSummaryPage.table.expectColumnsOf(report);
    await smsSummaryPage.table.expectRecordsOf(report);
  });

  test('offers the views the API configures', async ({ smsSummaryPage }) => {
    await smsSummaryPage.open();
    const report = await smsSummaryPage.openViaApi();

    expect(report.viewByOptions).toEqual(apiOptions);
    await smsSummaryPage.table.expectViewByOptions(apiOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view as the API returned it`, async ({ smsSummaryPage }) => {
      await smsSummaryPage.open();
      await smsSummaryPage.openViaApi();

      const report = await smsSummaryPage.table.viewBy(view);

      expect(report.params.get('group_by')).toBe(groupBy);
      await smsSummaryPage.table.expectActiveView(view);
      await smsSummaryPage.table.expectColumnsOf(report);
      await smsSummaryPage.table.expectRecordsOf(report);
    });
  }
});
