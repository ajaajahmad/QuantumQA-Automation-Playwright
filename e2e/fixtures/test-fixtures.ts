import { test as base } from '@playwright/test';
import { CampaignListPage } from '../pages/campaign/campaign-list.page';
import { CreateSmsCampaignPage } from '../pages/campaign/create-sms-campaign.page';
import { LogoutComponent } from '../pages/components/logout.component';
import { SideNav } from '../pages/components/side-nav.component';
import { LoginPage } from '../pages/login/login.page';
import { readSessionState } from '../utils/auth-state';

type QuantumFixtures = {
  useAuthenticatedSession: boolean;
  loginPage: LoginPage;
  logoutComponent: LogoutComponent;
  sideNav: SideNav;
  campaignListPage: CampaignListPage;
  createSmsCampaignPage: CreateSmsCampaignPage;
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
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  logoutComponent: async ({ page }, use) => {
    await use(new LogoutComponent(page));
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
});

export { expect } from '@playwright/test';
