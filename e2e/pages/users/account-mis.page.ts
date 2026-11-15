import { expect, type Locator, type Page } from '@playwright/test';
import { AdvancedSearchForm } from '../components/advanced-search-form.component';
import { ReportTableComponent } from '../components/report-table.component';
import { appConfig } from '../../utils/config';

// What differs between the channels' Account MIS pages. Everything else is the same widgets.
export type AccountMis = {
  heading: string;
  path: string;
  viaPanelSearch: string;
  viaApiSearch: string;
  viaPanelOptions: string;
  viaApiOptions: string;
};

export const smsAccountMis: AccountMis = {
  heading: 'SMS Account MIS',
  path: '/user-management/account-mis/sms',
  viaPanelSearch: '/api/v1/sms-mis/sms-child-user-advanced-summary',
  viaApiSearch: '/api/v1/sms-mis/sms-api-child-user-advanced-summary',
  viaPanelOptions: '/api/v1/analytics/sms-advanced-summary-child-user-filter-option',
  viaApiOptions: '/api/v1/analytics/sms-api-advanced-summary-child-user-filter-option',
};

export const whatsAppAccountMis: AccountMis = {
  heading: 'WhatsApp Account MIS',
  path: '/user-management/account-mis/whatsapp',
  viaPanelSearch: '/api/v1/account-whatsapp-mis/advanced-summary',
  viaApiSearch: '/api/v1/account-whatsapp-api-mis/advanced-summary',
  viaPanelOptions: '/api/v1/account-whatsapp-mis/advanced-summary-filter-option',
  viaApiOptions: '/api/v1/account-whatsapp-api-mis/advanced-summary-filter-option',
};

export const rcsAccountMis: AccountMis = {
  heading: 'RCS Account MIS',
  path: '/user-management/account-mis/rcs',
  viaPanelSearch: '/api/v1/account-rcs-mis/advance-summary',
  viaApiSearch: '/api/v1/account-rcs-api-mis/advance-summary',
  viaPanelOptions: '/api/v1/account-rcs-mis/advanced-summary-filter-option-by-field',
  viaApiOptions: '/api/v1/account-rcs-api-mis/advanced-summary-filter-option-by-field',
};

export const truecallerAccountMis: AccountMis = {
  heading: 'Truecaller Account MIS',
  path: '/user-management/account-mis/truecaller',
  viaPanelSearch: '/api/v1/account-truecaller-mis/advanced-summary',
  viaApiSearch: '/api/v1/account-truecaller-api-mis/advanced-summary',
  viaPanelOptions: '/api/v1/account-truecaller-mis/advanced-summary-filter-option-by-field',
  viaApiOptions: '/api/v1/account-truecaller-api-mis/advanced-summary-filter-option-by-field',
};

export const emailAccountMis: AccountMis = {
  heading: 'Email Account MIS',
  path: '/user-management/account-mis/email',
  viaPanelSearch: '/api/v1/account-email-mis/advanced-summary',
  viaApiSearch: '/api/v1/account-email-api-mis/email-api-advanced-summary',
  viaPanelOptions: '/api/v1/account-email-mis/advanced-summary-filter-option',
  viaApiOptions: '/api/v1/account-email-api-mis/advanced-summary-api-filter-option',
};

// Users > Account MIS > <channel>: the traffic of the accounts under this one. Both tabs show the
// search form of the advanced reports plus a Username field and, once searched, the same view-by
// bar and table; each tab posts to its own endpoint. Opened by URL because the side-nav entry
// does not navigate on staging.
export class AccountMisPage {
  readonly form: AdvancedSearchForm;
  readonly table: ReportTableComponent;

  private readonly heading: Locator;
  private readonly viaPanelTab: Locator;
  private readonly viaApiTab: Locator;
  private readonly results: Locator;

  constructor(
    private readonly page: Page,
    private readonly mis: AccountMis,
  ) {
    const searchPaths = [mis.viaPanelSearch, mis.viaApiSearch];
    this.form = new AdvancedSearchForm(page, searchPaths, [mis.viaPanelOptions, mis.viaApiOptions], 'app-account-mis');
    this.table = new ReportTableComponent(page, searchPaths);

    this.heading = page.getByRole('heading', { name: mis.heading, exact: true });
    this.viaPanelTab = page.getByRole('tab', { name: 'Via Panel', exact: true });
    this.viaApiTab = page.getByRole('tab', { name: 'Via API', exact: true });
    this.results = page.locator('app-account-mis app-mis-table');
  }

  // Opens on the Via Panel tab with the form expanded and nothing searched yet.
  async open(): Promise<void> {
    await this.page.goto(new URL(this.mis.path, appConfig.appUrl).toString(), { waitUntil: 'domcontentloaded' });
    await expect(this.heading).toBeVisible();
    await expect(this.page).toHaveURL(new RegExp(`${this.mis.path}/via-panel$`));
    await expect(this.viaPanelTab).toHaveAttribute('aria-selected', 'true');
    await this.form.expectExpanded();
  }

  async openViaApi(): Promise<void> {
    await this.viaApiTab.click();
    await expect(this.page).toHaveURL(new RegExp(`${this.mis.path}/via-api$`));
    await expect(this.viaApiTab).toHaveAttribute('aria-selected', 'true');
    await this.form.expectExpanded();
  }

  async expectNoResults(): Promise<void> {
    await expect(this.results).toHaveCount(0);
  }
}
