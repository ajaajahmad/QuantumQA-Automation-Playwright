import { expect, type Locator, type Page } from '@playwright/test';
import { waitForReport, type ReportCell, type ReportResponse } from '../../utils/report-response';

// The view-by bar, table and paging of the summary reports. A view is either a tab on the bar
// or an entry under More; picking a More entry puts its name on the More toggle.
export class ReportTableComponent {
  private readonly viewByBar: Locator;
  private readonly viewByLabel: Locator;
  private readonly viewTabs: Locator;
  private readonly activeTab: Locator;
  private readonly moreToggle: Locator;
  private readonly moreOptions: Locator;
  private readonly headers: Locator;
  private readonly dataRows: Locator;
  private readonly pageTotalRow: Locator;
  private readonly grandTotalRow: Locator;
  private readonly noRecords: Locator;
  private readonly pageSizeSelect: Locator;

  // reportPaths are the endpoints the table loads from, e.g. /api/v1/whatsapp-mis/viewby-campaign.
  constructor(
    private readonly page: Page,
    private readonly reportPaths: string[],
  ) {
    this.viewByBar = page.locator('app-table-viewby-filter');
    this.viewByLabel = this.viewByBar.locator('li.cursor-default');
    this.viewTabs = this.viewByBar.locator('.view_left ul').first().locator(':scope > li:not(.cursor-default):not(.dropdownn)');
    this.activeTab = this.viewTabs.and(page.locator('.active'));
    this.moreToggle = page.locator('#more_con');
    this.moreOptions = this.viewByBar.locator('ul.bottom_drop > li');
    this.headers = page.locator('app-mis-table thead th');
    this.dataRows = page.locator('app-mis-table tbody tr:not(.table_total)');
    this.pageTotalRow = page.locator('app-mis-table tbody tr.table_total', { hasText: 'Total (this page)' });
    this.grandTotalRow = page.locator('app-mis-table tbody tr.table_total', { hasText: 'Grand Total' });
    this.noRecords = page.locator('app-mis-table').getByText('No Records Found');
    this.pageSizeSelect = page.locator('app-table-pagination select');
  }

  async viewBy(view: string): Promise<ReportResponse> {
    const tab = this.viewTabs.getByText(view, { exact: true });

    if (await tab.isVisible()) {
      return waitForReport(this.page, this.reportPaths, () => tab.click());
    }

    await this.moreToggle.click();
    return waitForReport(this.page, this.reportPaths, () =>
      this.moreOptions.getByText(view, { exact: true }).click(),
    );
  }

  // A report whose views all fit on the bar has no More toggle.
  async expectViewByOptions(options: { tabs: string[]; more: string[] }): Promise<void> {
    await expect(this.viewTabs).toHaveText(options.tabs);

    if (options.more.length === 0) {
      await expect(this.moreToggle).toHaveCount(0);
      return;
    }

    await this.moreToggle.click();
    await expect(this.moreOptions).toHaveText(options.more);
    // The open list covers the toggle; the list closes on a click anywhere outside it.
    await this.viewByLabel.click();
    await expect(this.moreOptions).toHaveCount(0);
  }

  async expectActiveView(view: string): Promise<void> {
    if (await this.viewTabs.getByText(view, { exact: true }).isVisible()) {
      await expect(this.activeTab).toHaveText(view);
    } else {
      await expect(this.moreToggle).toHaveText(view);
      await expect(this.activeTab).toHaveCount(0);
    }
  }

  async expectColumnsOf(report: ReportResponse): Promise<void> {
    await expect(this.headers).toHaveText(report.columns);
  }

  // One row per doc on this page. The page and grand total rows below them are not counted,
  // and an empty report shows its message in a row of its own.
  async expectRecordsOf(report: ReportResponse): Promise<void> {
    if (report.docs.length === 0) {
      await expect(this.noRecords).toBeVisible();
      return;
    }

    await expect(this.noRecords).toBeHidden();
    await expect(this.dataRows).toHaveCount(report.docs.length);
  }

  // Every cell of every data row shows the value the response holds for it.
  async expectRowsOf(report: ReportResponse): Promise<void> {
    await this.expectRecordsOf(report);

    for (const [index, cells] of report.rows.entries()) {
      await this.expectCells(this.dataRows.nth(index), cells);
    }
  }

  // The page and grand total rows follow the data rows and show the response's totals.
  async expectTotalsOf(report: ReportResponse): Promise<void> {
    if (report.docs.length === 0) {
      await expect(this.pageTotalRow).toHaveCount(0);
      await expect(this.grandTotalRow).toHaveCount(0);
      return;
    }

    await this.expectCells(this.pageTotalRow, report.totals.page);
    await this.expectCells(this.grandTotalRow, report.totals.grand);
  }

  private async expectCells(row: Locator, cells: (ReportCell | undefined)[]): Promise<void> {
    for (const [index, cell] of cells.entries()) {
      if (cell === undefined) {
        continue;
      }

      const column = row.locator('td').nth(index);

      if (Array.isArray(cell)) {
        await expect(column.locator('p')).toHaveText(cell);
      } else {
        await expect(column).toHaveText(cell);
      }
    }
  }

  async expectFirstColumn(values: string[]): Promise<void> {
    await expect(this.dataRows.locator('td:first-child')).toHaveText(values);
  }

  async setPageSize(size: number): Promise<ReportResponse> {
    return waitForReport(this.page, this.reportPaths, () => this.pageSizeSelect.selectOption(String(size)));
  }
}
