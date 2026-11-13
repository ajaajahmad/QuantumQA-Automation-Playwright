import { expect, type Locator, type Page } from '@playwright/test';
import { waitForReport, type ReportResponse } from '../../utils/report-response';

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
  private readonly noRecords: Locator;
  private readonly pageSizeSelect: Locator;

  // reportPaths are the GET endpoints the table loads from, e.g. /api/v1/whatsapp-mis/viewby-campaign.
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

  async expectViewByOptions(options: { tabs: string[]; more: string[] }): Promise<void> {
    await expect(this.viewTabs).toHaveText(options.tabs);
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

  async expectFirstColumn(values: string[]): Promise<void> {
    await expect(this.dataRows.locator('td:first-child')).toHaveText(values);
  }

  async setPageSize(size: number): Promise<ReportResponse> {
    return waitForReport(this.page, this.reportPaths, () => this.pageSizeSelect.selectOption(String(size)));
  }
}
