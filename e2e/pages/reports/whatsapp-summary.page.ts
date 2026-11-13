import { expect, type Locator, type Page } from '@playwright/test';
import { ReportFiltersComponent } from '../components/report-filters.component';
import { ReportTableComponent } from '../components/report-table.component';
import { appConfig } from '../../utils/config';
import { waitForReport, type ReportResponse } from '../../utils/report-response';

// Reports > WhatsApp > Summary. Both tabs share the filters and table; each loads its own endpoint.
const viaPanelReport = '/api/v1/whatsapp-mis/viewby-campaign';
const viaApiReport = '/api/v1/whatsapp-api-mis';
const reportPaths = [viaPanelReport, viaApiReport];

export class WhatsAppSummaryPage {
  readonly filters: ReportFiltersComponent;
  readonly table: ReportTableComponent;

  private readonly heading: Locator;
  private readonly viaApiTab: Locator;

  constructor(private readonly page: Page) {
    this.filters = new ReportFiltersComponent(page, reportPaths);
    this.table = new ReportTableComponent(page, reportPaths);

    this.heading = page.getByRole('heading', { name: 'WhatsApp Summary', exact: true });
    this.viaApiTab = page.getByRole('tab', { name: 'Via API', exact: true });
  }

  // Opens on the Via Panel tab and returns the report it loaded first.
  async open(): Promise<ReportResponse> {
    const report = await waitForReport(this.page, [viaPanelReport], () =>
      this.page.goto(new URL('/reports/whatsapp/summary', appConfig.appUrl).toString(), {
        waitUntil: 'domcontentloaded',
      }),
    );
    await expect(this.heading).toBeVisible();
    return report;
  }

  async openViaApi(): Promise<ReportResponse> {
    const report = await waitForReport(this.page, [viaApiReport], () => this.viaApiTab.click());
    await expect(this.page).toHaveURL(/\/reports\/whatsapp\/summary\/via-api$/);
    return report;
  }
}
