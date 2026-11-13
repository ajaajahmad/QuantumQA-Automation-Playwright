import { expect, type Locator, type Page } from '@playwright/test';
import { usDate } from '../../utils/date-time';
import { waitForReport, type ReportResponse } from '../../utils/report-response';

export type ReportCounts = 'Submission' | 'Billable';

// The counts, period and date controls above the summary reports.
export class ReportFiltersComponent {
  private readonly periodSelect: Locator;
  private readonly dateRangeInput: Locator;
  private readonly monthYearPicker: Locator;
  private readonly monthYearToggle: Locator;

  // reportPaths are the GET endpoints these controls reload, e.g. /api/v1/whatsapp-mis/viewby-campaign.
  constructor(
    private readonly page: Page,
    private readonly reportPaths: string[],
  ) {
    this.periodSelect = page.locator('.report-category ng-select');
    this.dateRangeInput = page.getByPlaceholder('Select Date Range');
    this.monthYearPicker = page.locator('app-month-year-dropdown');
    this.monthYearToggle = this.monthYearPicker.locator('.placeholder-color');
  }

  async countBy(counts: ReportCounts): Promise<ReportResponse> {
    return waitForReport(this.page, this.reportPaths, () =>
      this.page.getByRole('radio', { name: counts }).check({ force: true }),
    );
  }

  async expectCountedBy(counts: ReportCounts): Promise<void> {
    await expect(this.page.getByRole('radio', { name: counts })).toBeChecked();
  }

  async setDateRange(from: Date, to: Date): Promise<ReportResponse> {
    return waitForReport(this.page, this.reportPaths, async () => {
      await this.dateRangeInput.fill(`${usDate(from)} - ${usDate(to)}`);
      await this.dateRangeInput.press('Enter');
    });
  }

  async expectDateRange(from: Date, to: Date): Promise<void> {
    await expect(this.dateRangeInput).toHaveValue(`${usDate(from)} - ${usDate(to)}`);
  }

  // Monthly reports cover whole months; the month only counts once a year is picked for it.
  async reportMonth(month: string, year: number): Promise<ReportResponse> {
    await this.choosePeriod('Monthly');
    await this.monthYearToggle.click();
    const row = this.monthYearPicker.locator('.month-year-data-wrapper').filter({ hasText: month });
    await row.locator('mat-checkbox').click();
    await row.locator('app-custom-select-with-create').click();
    await row.getByText(String(year), { exact: true }).click();
    return this.applyMonthYear();
  }

  async reportYear(year: number): Promise<ReportResponse> {
    await this.choosePeriod('Yearly');
    await this.monthYearToggle.click();
    await this.monthYearPicker.locator('mat-checkbox').filter({ hasText: String(year) }).click();
    return this.applyMonthYear();
  }

  // The picker summarises the selection, e.g. "Month (1)".
  async expectMonthYearSelection(summary: string): Promise<void> {
    await expect(this.monthYearToggle).toHaveText(summary);
  }

  private async choosePeriod(period: 'Custom' | 'Monthly' | 'Yearly'): Promise<void> {
    await this.periodSelect.click();
    await this.page.getByRole('option', { name: period, exact: true }).click();
  }

  private applyMonthYear(): Promise<ReportResponse> {
    return waitForReport(this.page, this.reportPaths, () =>
      this.monthYearPicker.getByRole('button', { name: 'Apply' }).click(),
    );
  }
}
