import { type APIRequestContext, test as base } from '@playwright/test';
import {
  AdminGroupListPage,
  adminUsersList,
  rolePermissionsList,
  salesUsersList,
} from '../pages/admin/admin-group/admin-group-list.page';
import { AdminUserFormPage } from '../pages/admin/admin-group/admin-user-form.page';
import { RoleFormPage } from '../pages/admin/admin-group/role-form.page';
import { AdminHeader } from '../pages/admin/components/admin-header.component';
import { AdminSideNav } from '../pages/admin/components/admin-side-nav.component';
import { AdminLoginPage } from '../pages/admin/login/admin-login.page';
import { AdminListPage } from '../pages/admin/onboarding/admin-list.page';
import { OrganizationsPage } from '../pages/admin/organizations/organizations.page';
import { CreateUserPage } from '../pages/admin/users/create-user.page';
import { EditUserPage } from '../pages/admin/users/edit-user.page';
import { UsersPage } from '../pages/admin/users/users.page';
import { createAdminApi } from '../utils/admin-api';
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
  adminListPage: AdminListPage;
  createUserPage: CreateUserPage;
  usersPage: UsersPage;
  editUserPage: EditUserPage;
  adminApi: APIRequestContext;
  adminUsersPage: AdminGroupListPage;
  rolePermissionsPage: AdminGroupListPage;
  salesUsersPage: AdminGroupListPage;
  adminUserFormPage: AdminUserFormPage;
  roleFormPage: RoleFormPage;
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
  adminListPage: async ({ page }, use) => {
    await use(new AdminListPage(page));
  },
  createUserPage: async ({ page }, use) => {
    await use(new CreateUserPage(page));
  },
  usersPage: async ({ page }, use) => {
    await use(new UsersPage(page));
  },
  editUserPage: async ({ page }, use) => {
    await use(new EditUserPage(page));
  },
  // The admin API with the saved admin session's token, which it takes without a Bearer prefix.
  adminApi: async ({ playwright }, use) => {
    const api = await createAdminApi(playwright.request);
    await use(api);
    await api.dispose();
  },
  adminUsersPage: async ({ page }, use) => {
    await use(new AdminGroupListPage(page, adminUsersList));
  },
  rolePermissionsPage: async ({ page }, use) => {
    await use(new AdminGroupListPage(page, rolePermissionsList));
  },
  salesUsersPage: async ({ page }, use) => {
    await use(new AdminGroupListPage(page, salesUsersList));
  },
  adminUserFormPage: async ({ page }, use) => {
    await use(new AdminUserFormPage(page));
  },
  roleFormPage: async ({ page }, use) => {
    await use(new RoleFormPage(page));
  },
});

export { expect } from '@playwright/test';
