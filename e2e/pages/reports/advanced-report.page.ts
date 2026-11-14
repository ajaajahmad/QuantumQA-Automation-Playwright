import { expect, type Locator, type Page } from '@playwright/test';
import { AdvancedSearchForm } from '../components/advanced-search-form.component';
import { ReportTableComponent } from '../components/report-table.component';
import { appConfig } from '../../utils/config';

// What differs between the channels' advanced reports. Everything else is the same widgets.
export type AdvancedReport = {
  heading: string;
  path: string;
  viaPanelSearch: string;
  viaApiSearch: string;
  viaPanelOptions: string;
  viaApiOptions: string;
};

export const whatsAppAdvanced: AdvancedReport = {
  heading: 'WhatsApp Advanced Search',
  path: '/reports/whatsapp/advanced',
  viaPanelSearch: '/api/v1/whatsapp-mis/whatsapp-advanced-summary',
  viaApiSearch: '/api/v1/whatsapp-api-mis/whatsapp-api-advanced-summary',
  viaPanelOptions: '/api/v1/whatsapp-mis/advanced-summary-filter-option-by-field',
  viaApiOptions: '/api/v1/whatsapp-api-mis/advanced-summary-api-filter-option-by-field',
};

// Reports > <channel> > Advanced. Both tabs show a search form and, once searched, the same
// view-by bar and table as the summary reports; each tab posts to its own endpoint.
export class AdvancedReportPage {
  readonly form: AdvancedSearchForm;
  readonly table: ReportTableComponent;

  private readonly heading: Locator;
  private readonly viaPanelTab: Locator;
  private readonly viaApiTab: Locator;
  private readonly results: Locator;

  constructor(
    private readonly page: Page,
    private readonly report: AdvancedReport,
  ) {
    const searchPaths = [report.viaPanelSearch, report.viaApiSearch];
    this.form = new AdvancedSearchForm(page, searchPaths, [report.viaPanelOptions, report.viaApiOptions]);
    this.table = new ReportTableComponent(page, searchPaths);

    this.heading = page.getByRole('heading', { name: report.heading, exact: true });
    this.viaPanelTab = page.getByRole('tab', { name: 'Via Panel', exact: true });
    this.viaApiTab = page.getByRole('tab', { name: 'Via API', exact: true });
    this.results = page.locator('app-advanced app-mis-table');
  }

  // Opens on the Via Panel tab with the form expanded and nothing searched yet.
  async open(): Promise<void> {
    await this.page.goto(new URL(this.report.path, appConfig.appUrl).toString(), { waitUntil: 'domcontentloaded' });
    await expect(this.heading).toBeVisible();
    await expect(this.page).toHaveURL(new RegExp(`${this.report.path}/via-panel$`));
    await expect(this.viaPanelTab).toHaveAttribute('aria-selected', 'true');
    await this.form.expectExpanded();
  }

  async openViaApi(): Promise<void> {
    await this.viaApiTab.click();
    await expect(this.page).toHaveURL(new RegExp(`${this.report.path}/via-api$`));
    await expect(this.viaApiTab).toHaveAttribute('aria-selected', 'true');
    await this.form.expectExpanded();
  }

  async expectNoResults(): Promise<void> {
    await expect(this.results).toHaveCount(0);
  }
}
