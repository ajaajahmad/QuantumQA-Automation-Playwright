import { test as base } from '@playwright/test';
import { AdminHeader } from '../pages/admin/components/admin-header.component';
import { AdminSideNav } from '../pages/admin/components/admin-side-nav.component';
import { AdminLoginPage } from '../pages/admin/login/admin-login.page';
import { OrganizationsPage } from '../pages/admin/organizations/organizations.page';
import { adminSession, restoreSessionStorage } from '../utils/auth-state';
import { requireAdminUrl } from '../utils/config';

// The admin panel's fixtures, apart from the panel's: its own page objects and saved session.
// Admin specs are read-only by design, because admin changes reach every account on staging.
type AdminFixtures = {
  useAuthenticatedSession: boolean;
  adminLoginPage: AdminLoginPage;
  adminHeader: AdminHeader;
  adminSideNav: AdminSideNav;
  organizationsPage: OrganizationsPage;
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
  adminSideNav: async ({ page }, use) => {
    await use(new AdminSideNav(page));
  },
  organizationsPage: async ({ page }, use) => {
    await use(new OrganizationsPage(page));
  },
});

export { expect } from '@playwright/test';
