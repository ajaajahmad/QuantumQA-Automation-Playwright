import { test as base } from '@playwright/test';
import { AdminHeader } from '../pages/admin/components/admin-header.component';
import { AdminLoginPage } from '../pages/admin/login/admin-login.page';
import { adminSession, restoreSessionStorage } from '../utils/auth-state';
import { requireAdminUrl } from '../utils/config';

// The admin panel's fixtures, apart from the panel's: its own page objects and saved session.
// Admin specs are read-only by design, because admin changes reach every account on staging.
type AdminFixtures = {
  useAuthenticatedSession: boolean;
  adminLoginPage: AdminLoginPage;
  adminHeader: AdminHeader;
};

export const test = base.extend<AdminFixtures>({
  useAuthenticatedSession: [true, { option: true }],
  context: async ({ context, useAuthenticatedSession }, use) => {
    requireAdminUrl();

    if (useAuthenticatedSession) {
      await restoreSessionStorage(context, adminSession);
    }

    await use(context);
  },
  adminLoginPage: async ({ page }, use) => {
    await use(new AdminLoginPage(page));
  },
  adminHeader: async ({ page }, use) => {
    await use(new AdminHeader(page));
  },
});

export { expect } from '@playwright/test';
