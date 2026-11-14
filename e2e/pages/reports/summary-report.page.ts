import { expect, type Locator, type Page } from '@playwright/test';
import { ReportFilterBarComponent } from '../components/report-filter-bar.component';
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
  // Only channels with two-way messaging have the Incoming Messages tab.
  viaIncomingReport?: string;
};

export const whatsAppSummary: SummaryReport = {
  heading: 'WhatsApp Summary',
  path: '/reports/whatsapp/summary',
  viaPanelReport: '/api/v1/whatsapp-mis/viewby-campaign',
  viaApiReport: '/api/v1/whatsapp-api-mis',
  viaIncomingReport: '/api/v1/whatsapp-user-responses/summary',
};

export const smsSummary: SummaryReport = {
  heading: 'SMS Summary',
  path: '/reports/sms/summary',
  viaPanelReport: '/api/v1/sms-mis/viewby-campaign',
  viaApiReport: '/api/v1/sms-api-mis',
};

export const rcsSummary: SummaryReport = {
  heading: 'RCS Summary',
  path: '/reports/rcs/summary',
  viaPanelReport: '/api/v1/rcs-mis/viewby-campaign',
  viaApiReport: '/api/v1/rcs-api-mis',
};

export const truecallerSummary: SummaryReport = {
  heading: 'Truecaller Summary',
  path: '/reports/truecaller/summary',
  viaPanelReport: '/api/v1/truecaller-mis/viewby-campaign',
  viaApiReport: '/api/v1/truecaller-api-mis',
};

// Reports > <channel> > Summary. The tabs share the filters and table; each loads its own endpoint.
export class SummaryReportPage {
  readonly filters: ReportFiltersComponent;
  readonly filterBar: ReportFilterBarComponent;
  readonly table: ReportTableComponent;

  private readonly heading: Locator;
  private readonly viaApiTab: Locator;
  private readonly incomingMessagesTab: Locator;

  constructor(
    private readonly page: Page,
    private readonly report: SummaryReport,
  ) {
    const reportPaths = [report.viaPanelReport, report.viaApiReport];

    if (report.viaIncomingReport) {
      reportPaths.push(report.viaIncomingReport);
    }

    this.filters = new ReportFiltersComponent(page, reportPaths);
    this.filterBar = new ReportFilterBarComponent(page, reportPaths);
    this.table = new ReportTableComponent(page, reportPaths);

    this.heading = page.getByRole('heading', { name: report.heading, exact: true });
    this.viaApiTab = page.getByRole('tab', { name: 'Via API', exact: true });
    this.incomingMessagesTab = page.getByRole('tab', { name: 'Incoming Messages', exact: true });
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

  async openIncomingMessages(): Promise<ReportResponse> {
    if (!this.report.viaIncomingReport) {
      throw new Error(`${this.report.heading} has no Incoming Messages tab.`);
    }

    const report = await waitForReport(this.page, [this.report.viaIncomingReport], () => this.incomingMessagesTab.click());
    await expect(this.page).toHaveURL(new RegExp(`${this.report.path}/via-incoming-messages$`));
    return report;
  }

  // The tab is there only for accounts with two-way messaging switched on.
  async hasIncomingMessages(): Promise<boolean> {
    return this.incomingMessagesTab.isVisible();
  }

  async expectTabs(tabs: string[]): Promise<void> {
    await expect(this.page.locator('app-mis-common-tabs').getByRole('tab')).toHaveText(tabs);
  }
}
