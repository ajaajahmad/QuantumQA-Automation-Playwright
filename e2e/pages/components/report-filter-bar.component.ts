import { expect, type Locator, type Page } from '@playwright/test';
import { waitForReport, type ReportResponse } from '../../utils/report-response';

// The Filter By bar between a summary report's controls and its table. Each button opens the
// values the account has for that field in the period; ticking some and applying reloads the
// report with them, and the button then shows how many are ticked and a cross to clear them.
export class ReportFilterBarComponent {
  private readonly bar: Locator;
  private readonly buttons: Locator;
  private readonly openList: Locator;

  // reportPaths are the endpoints the filters reload, e.g. /api/v1/whatsapp-mis/viewby-campaign.
  constructor(
    private readonly page: Page,
    private readonly reportPaths: string[],
  ) {
    this.bar = page.locator('app-table-more-filter');
    this.buttons = this.bar.locator('button.filter-btn');
    this.openList = this.bar.locator('.sub-filter-div');
  }

  async expectFilters(names: string[]): Promise<void> {
    await expect(this.buttons.locator(':scope > span:first-child')).toHaveText(names);
  }

  // Opens a filter's list, returns the values it offers and closes it again.
  async options(name: string): Promise<string[]> {
    await this.button(name).click();
    await expect(this.openList).toBeVisible();
    const options = await this.openList.locator('.option-label').allInnerTexts();
    await this.close();
    return options.map((option) => option.trim());
  }

  async filterBy(name: string, value: string): Promise<ReportResponse> {
    await this.button(name).click();
    await this.openList.locator('li').filter({ hasText: value }).locator('mat-checkbox').click();

    return waitForReport(this.page, this.reportPaths, () =>
      this.openList.getByRole('button', { name: 'Apply' }).click(),
    );
  }

  async expectFilterCount(name: string, count: number): Promise<void> {
    await expect(this.button(name)).toContainText(`(${count})`);
  }

  async expectFilterClear(name: string): Promise<void> {
    await expect(this.button(name)).toHaveText(name);
  }

  async clearFilter(name: string): Promise<ReportResponse> {
    return waitForReport(this.page, this.reportPaths, () => this.button(name).locator('.icon-fl-close').click());
  }

  private button(name: string): Locator {
    return this.buttons.filter({ has: this.page.locator(':scope > span:first-child', { hasText: new RegExp(`^\\s*${name}\\s*$`) }) });
  }

  // The list closes on a click anywhere outside it.
  private async close(): Promise<void> {
    await this.bar.getByText('Filter By').click();
    await expect(this.openList).toHaveCount(0);
  }
}
