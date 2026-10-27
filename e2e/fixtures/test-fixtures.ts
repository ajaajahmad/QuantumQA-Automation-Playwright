import { test as base } from '@playwright/test';
import { LoginErrorPage } from '../pages/login/login-error.page';
import { LoginPage } from '../pages/login/login.page';
import { SmsCampaignPage } from '../pages/campaign/sms-campaign.page';
import { LogoutComponent } from '../pages/components/logout.component';
import { readSessionState } from '../utils/auth-state';

type QuantumFixtures = {
  useAuthenticatedSession: boolean;
  loginPage: LoginPage;
  loginErrorPage: LoginErrorPage;
  logoutComponent: LogoutComponent;
  smsCampaignPage: SmsCampaignPage;
};

export const test = base.extend<QuantumFixtures>({
  useAuthenticatedSession: [true, { option: true }],
  context: async ({ context, useAuthenticatedSession }, use) => {
    if (useAuthenticatedSession) {
      const sessionState = readSessionState();

      if (sessionState) {
        await context.addInitScript((state) => {
          if (window.location.origin !== state.origin) {
            return;
          }

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
  loginErrorPage: async ({ page }, use) => {
    await use(new LoginErrorPage(page));
  },
  logoutComponent: async ({ page }, use) => {
    await use(new LogoutComponent(page));
  },
  smsCampaignPage: async ({ page }, use) => {
    await use(new SmsCampaignPage(page));
  },
});

export { expect } from '@playwright/test';
