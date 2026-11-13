import { expect, type Locator, type Page } from '@playwright/test';
import { ReportFiltersComponent } from '../components/report-filters.component';
import { ReportTableComponent } from '../components/report-table.component';
import { appConfig } from '../../utils/config';
import { waitForReport, type ReportResponse } from '../../utils/report-response';

// What differs between the channels' summary reports. Everything else is the same widgets.
export type SummaryReport = {
  heading: string;
  path: string;
  viaPanelReport: string;
  viaApiReport: string;
};

export const whatsAppSummary: SummaryReport = {
  heading: 'WhatsApp Summary',
  path: '/reports/whatsapp/summary',
  viaPanelReport: '/api/v1/whatsapp-mis/viewby-campaign',
  viaApiReport: '/api/v1/whatsapp-api-mis',
};

export const smsSummary: SummaryReport = {
  heading: 'SMS Summary',
  path: '/reports/sms/summary',
  viaPanelReport: '/api/v1/sms-mis/viewby-campaign',
  viaApiReport: '/api/v1/sms-api-mis',
};

// Reports > <channel> > Summary. Both tabs share the filters and table; each loads its own endpoint.
export class SummaryReportPage {
  readonly filters: ReportFiltersComponent;
  readonly table: ReportTableComponent;

  private readonly heading: Locator;
  private readonly viaApiTab: Locator;

  constructor(
    private readonly page: Page,
    private readonly report: SummaryReport,
  ) {
    const reportPaths = [report.viaPanelReport, report.viaApiReport];
    this.filters = new ReportFiltersComponent(page, reportPaths);
    this.table = new ReportTableComponent(page, reportPaths);

    this.heading = page.getByRole('heading', { name: report.heading, exact: true });
    this.viaApiTab = page.getByRole('tab', { name: 'Via API', exact: true });
  }

  // Opens on the Via Panel tab and returns the report it loaded first.
  async open(): Promise<ReportResponse> {
    const report = await waitForReport(this.page, [this.report.viaPanelReport], () =>
      this.page.goto(new URL(this.report.path, appConfig.appUrl).toString(), {
        waitUntil: 'domcontentloaded',
      }),
    );
    await expect(this.heading).toBeVisible();
    return report;
  }

  async openViaApi(): Promise<ReportResponse> {
    const report = await waitForReport(this.page, [this.report.viaApiReport], () => this.viaApiTab.click());
    await expect(this.page).toHaveURL(new RegExp(`${this.report.path}/via-api$`));
    return report;
  }
}
