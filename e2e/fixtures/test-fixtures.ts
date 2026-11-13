import { test as base, type APIRequestContext } from '@playwright/test';
import { CampaignListPage } from '../pages/campaign/campaign-list.page';
import { CreateSmsCampaignPage } from '../pages/campaign/create-sms-campaign.page';
import { AppHeader } from '../pages/components/app-header.component';
import { LogoutComponent } from '../pages/components/logout.component';
import { SideNav } from '../pages/components/side-nav.component';
import { DashboardPage } from '../pages/dashboard/dashboard.page';
import { ForgotPasswordPage } from '../pages/login/forgot-password.page';
import { LoginPage } from '../pages/login/login.page';
import { WhatsAppSummaryPage } from '../pages/reports/whatsapp-summary.page';
import { CreateSenderIdPage } from '../pages/sms/create-sender-id.page';
import { CreateTemplatePage } from '../pages/sms/create-template.page';
import { SenderIdsPage } from '../pages/sms/sender-ids.page';
import { TemplatesPage } from '../pages/sms/templates.page';
import { readAccessToken, readSessionState } from '../utils/auth-state';
import { appConfig } from '../utils/config';

type QuantumFixtures = {
  useAuthenticatedSession: boolean;
  api: APIRequestContext;
  loginPage: LoginPage;
  forgotPasswordPage: ForgotPasswordPage;
  logoutComponent: LogoutComponent;
  appHeader: AppHeader;
  dashboardPage: DashboardPage;
  sideNav: SideNav;
  campaignListPage: CampaignListPage;
  createSmsCampaignPage: CreateSmsCampaignPage;
  senderIdsPage: SenderIdsPage;
  createSenderIdPage: CreateSenderIdPage;
  templatesPage: TemplatesPage;
  createTemplatePage: CreateTemplatePage;
  whatsAppSummaryPage: WhatsAppSummaryPage;
};

export const test = base.extend<QuantumFixtures>({
  useAuthenticatedSession: [true, { option: true }],
  context: async ({ context, useAuthenticatedSession }, use) => {
    if (useAuthenticatedSession) {
      const sessionState = readSessionState();

      if (sessionState) {
        // Init scripts run on every navigation. Restore only once per tab so a reload
        // doesn't overwrite tokens the app has refreshed, or undo a logout.
        await context.addInitScript((state) => {
          const restoredKey = '__pw_session_restored';

          if (window.location.origin !== state.origin || window.sessionStorage.getItem(restoredKey)) {
            return;
          }

          window.sessionStorage.setItem(restoredKey, '1');

          for (const entry of state.sessionStorage) {
            window.sessionStorage.setItem(entry.key, entry.value);
          }
        }, sessionState);
      }
    }

    await use(context);
  },
  // Calls the API with the token auth setup saved, e.g. api.get('/api/v1/settings').
  api: async ({ playwright }, use) => {
    const token = readAccessToken();

    if (!token) {
      throw new Error('No saved access token. Run the auth-setup project first.');
    }

    const api = await playwright.request.newContext({
      baseURL: appConfig.apiUrl,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });

    await use(api);
    await api.dispose();
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  forgotPasswordPage: async ({ page }, use) => {
    await use(new ForgotPasswordPage(page));
  },
  logoutComponent: async ({ page }, use) => {
    await use(new LogoutComponent(page));
  },
  appHeader: async ({ page }, use) => {
    await use(new AppHeader(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  sideNav: async ({ page }, use) => {
    await use(new SideNav(page));
  },
  campaignListPage: async ({ page }, use) => {
    await use(new CampaignListPage(page));
  },
  createSmsCampaignPage: async ({ page }, use) => {
    await use(new CreateSmsCampaignPage(page));
  },
  senderIdsPage: async ({ page }, use) => {
    await use(new SenderIdsPage(page));
  },
  createSenderIdPage: async ({ page }, use) => {
    await use(new CreateSenderIdPage(page));
  },
  templatesPage: async ({ page }, use) => {
    await use(new TemplatesPage(page));
  },
  createTemplatePage: async ({ page }, use) => {
    await use(new CreateTemplatePage(page));
  },
  whatsAppSummaryPage: async ({ page }, use) => {
    await use(new WhatsAppSummaryPage(page));
  },
});

export { expect } from '@playwright/test';
