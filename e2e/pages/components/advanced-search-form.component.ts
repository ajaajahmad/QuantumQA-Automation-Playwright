import { expect, type Locator, type Page } from '@playwright/test';
import { isoDate } from '../../utils/date-time';
import { waitForReport, type ReportResponse } from '../../utils/report-response';

// The dates and filters of an advanced report, which only load a report once Search is clicked.
// A list field offers the values the account has in the period, fetched when its list opens; the
// fields with a mode can instead match text (Contains, Does Not Contain). The form collapses to
// its dates once a search runs and expands again from the arrow.
export class AdvancedSearchForm {
  private readonly form: Locator;
  private readonly panel: Locator;
  private readonly toggle: Locator;
  private readonly startDate: Locator;
  private readonly endDate: Locator;
  private readonly searchButton: Locator;

  // searchPaths are the POST endpoints Search loads; optionPaths the GET endpoints a list opens.
  constructor(
    private readonly page: Page,
    private readonly searchPaths: string[],
    private readonly optionPaths: string[],
  ) {
    this.form = page.locator('app-advanced app-search');
    this.panel = this.form.locator('mat-expansion-panel');
    this.toggle = this.form.locator('.icon-Down_arrow');
    this.startDate = this.form.getByPlaceholder('Select Date').first();
    this.endDate = this.form.getByPlaceholder('Select Date').nth(1);
    this.searchButton = this.form.getByRole('button', { name: 'Search' });
  }

  // Dates are typed as YYYY-MM-DD. Enter would toggle the panel the dates sit in, so Tab commits them.
  async setDates(from: Date, to: Date): Promise<void> {
    await this.startDate.fill(isoDate(from));
    await this.startDate.press('Tab');
    await this.endDate.fill(isoDate(to));
    await this.endDate.press('Tab');
  }

  async expectDates(from: Date, to: Date): Promise<void> {
    await expect(this.startDate).toHaveValue(isoDate(from));
    await expect(this.endDate).toHaveValue(isoDate(to));
  }

  // The mode and counts radios have labels of their own, marked by Material.
  async expectFields(labels: string[]): Promise<void> {
    await expect(this.panel.locator('label:not(.mdc-label)')).toHaveText(labels);
  }

  // Opens a field's list and returns what the API offered for it and what the list shows.
  async listOptions(field: string): Promise<{ params: URLSearchParams; offered: string[]; shown: string[] }> {
    const request = this.page.waitForRequest(
      (candidate) => candidate.method() === 'GET' && this.optionPaths.includes(new URL(candidate.url()).pathname),
    );
    await this.field(field).locator('ng-select').click();
    const response = await (await request).response();
    const body = (await response?.json()) as { data: { key: string }[] };
    const shown = (await this.page.locator('ng-dropdown-panel .ng-option').allInnerTexts()).map((text) => text.trim());
    await this.page.keyboard.press('Escape');

    return {
      params: new URL((await request).url()).searchParams,
      offered: body.data.map((option) => option.key),
      shown,
    };
  }

  async select(field: string, option: string): Promise<void> {
    const block = this.field(field);
    const selectMode = block.getByRole('radio', { name: 'Select', exact: true });

    if (await selectMode.count()) {
      await selectMode.check({ force: true });
    }

    await block.locator('ng-select').click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
  }

  async contains(field: string, text: string): Promise<void> {
    await this.matchText(field, 'Contains', text);
  }

  async doesNotContain(field: string, text: string): Promise<void> {
    await this.matchText(field, 'Does Not Contain', text);
  }

  // Tags and GUID on the Via API tab are plain text fields.
  async fill(field: string, text: string): Promise<void> {
    await this.field(field).locator('input.filter-search').fill(text);
  }

  async countBy(counts: string): Promise<void> {
    await this.form.getByRole('radio', { name: counts }).check({ force: true });
  }

  async expectCountedBy(counts: string): Promise<void> {
    await expect(this.form.getByRole('radio', { name: counts })).toBeChecked();
  }

  async search(): Promise<ReportResponse> {
    return waitForReport(this.page, this.searchPaths, () => this.searchButton.click());
  }

  // An invalid form shows the reason, stays expanded and loads nothing.
  async expectSearchRefused(reason: string): Promise<void> {
    await this.searchButton.click();
    await expect(this.page.getByText(reason, { exact: true })).toBeVisible();
    await this.expectExpanded();
  }

  async expand(): Promise<void> {
    if (!(await this.panel.evaluate((panel) => panel.classList.contains('mat-expanded')))) {
      await this.toggle.click();
    }

    await this.expectExpanded();
  }

  async expectExpanded(): Promise<void> {
    await expect(this.panel).toHaveClass(/mat-expanded/);
    await expect(this.searchButton).toBeVisible();
  }

  async expectCollapsed(): Promise<void> {
    await expect(this.panel).not.toHaveClass(/mat-expanded/);
    await expect(this.searchButton).toBeHidden();
  }

  private async matchText(field: string, mode: 'Contains' | 'Does Not Contain', text: string): Promise<void> {
    const block = this.field(field);
    await block.getByRole('radio', { name: mode, exact: true }).check({ force: true });
    await block.locator('input.filter-search').fill(text);
  }

  // The block holding a field's label, mode radios and control.
  private field(label: string): Locator {
    return this.form.locator('.col-md-5').filter({
      has: this.page.locator('label', { hasText: new RegExp(`^\\s*${label}\\s*$`) }),
    });
  }
}
