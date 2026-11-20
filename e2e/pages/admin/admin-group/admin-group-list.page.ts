import { expect, type Locator, type Page } from '@playwright/test';
import { appConfig } from '../../../utils/config';
import { AdminListFilters } from '../components/admin-list-filters.component';
import { ConfirmDialog } from '../components/confirm.dialog';
import { MessageDialog } from '../components/message.dialog';
import { readSaveResult, type SaveResult } from '../components/user-form.component';
import { AdminSideNav } from '../components/admin-side-nav.component';
import { AdminTable, type LoadedList } from '../components/admin-table.component';

// One list page of the Admin side-nav group: its entry, route, heading, list endpoint, search box
// and create button. Opening the group also opens its first entry.
export type AdminGroupList = {
  entry: string;
  firstInGroup?: boolean;
  path: string;
  heading: string;
  api: string;
  searchPlaceholder: string;
  createButton: string;
};

export const adminUsersList: AdminGroupList = {
  entry: 'Admin Users',
  firstInGroup: true,
  path: '#/admin/admin-users',
  heading: 'Admin Users',
  api: '/api/v1/auth/users',
  searchPlaceholder: 'Username, Country',
  createButton: 'Create Admin User',
};

export const rolePermissionsList: AdminGroupList = {
  entry: 'Role Permissions',
  path: '#/roles/role-listing',
  heading: 'Role Permissions',
  api: '/api/v1/roles',
  searchPlaceholder: 'Role',
  createButton: 'Create Role',
};

export const salesUsersList: AdminGroupList = {
  entry: 'Sales Users',
  path: '#/sales-user/listing',
  heading: 'Sales Users',
  api: '/api/v1/sales-users',
  searchPlaceholder: 'Email',
  createButton: 'Create Sales User',
};

export const adminGroupLists = [adminUsersList, rolePermissionsList, salesUsersList];

// A list page of the Admin group. Only Admin Users has a filter bar, and only Role Permissions has
// a Delete action, which asks in a confirmation dialog first.
export class AdminGroupListPage {
  readonly sideNav: AdminSideNav;
  readonly table: AdminTable;
  readonly filters: AdminListFilters;
  readonly confirmDialog: ConfirmDialog;
  readonly messageDialog: MessageDialog;

  private readonly page: Page;
  private readonly list: AdminGroupList;
  private readonly heading: Locator;
  private readonly searchInput: Locator;
  private readonly createButton: Locator;

  constructor(page: Page, list: AdminGroupList) {
    this.page = page;
    this.list = list;
    this.sideNav = new AdminSideNav(page);
    this.table = new AdminTable(page, list.api);
    this.filters = new AdminListFilters(page, this.table);
    this.confirmDialog = new ConfirmDialog(page);
    this.messageDialog = new MessageDialog(page);
    this.heading = page.getByRole('heading', { name: list.heading, exact: true, level: 1 });
    this.searchInput = page.getByPlaceholder(list.searchPlaceholder, { exact: true });
    this.createButton = page.getByRole('button', { name: list.createButton, exact: true });
  }

  // A fresh load of an Admin group route lands on Organizations, so the page is reached through
  // the side nav. Opening the group usually lands on Admin Users and loads its list, and a click on
  // the entry then doesn't load it again; when the group click doesn't navigate, the entry does.
  // The other lists are opened from their entries. Returns the list the page loaded.
  async open<T>(): Promise<LoadedList<T>> {
    await this.page.goto(new URL('#/organizations/listing', appConfig.adminUrl).toString(), {
      waitUntil: 'domcontentloaded',
    });
    const list = await this.table.load<T>(async () => {
      await this.sideNav.openGroup('Admin');

      if (!this.list.firstInGroup) {
        await this.sideNav.openEntry(this.list.entry);
        return;
      }

      try {
        await this.page.waitForURL(new RegExp(`${escapeRegExp(this.list.path)}$`), { timeout: 3000 });
      } catch {
        await this.sideNav.openEntry(this.list.entry);
      }
    });
    await this.expectDisplayed();
    // Admin Users loads its list twice on opening; a click while the second copy re-renders the
    // table is lost, so the page is left to settle first. Staging may keep a request open, so the
    // wait gives up after a few seconds rather than failing.
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
    return list;
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${escapeRegExp(this.list.path)}$`));
    await expect(this.heading).toBeVisible();
  }

  // Search runs on Enter, not while typing.
  async search<T>(term: string): Promise<LoadedList<T>> {
    await this.searchInput.fill(term);
    return this.table.load<T>(() => this.searchInput.press('Enter'), { queryterm: term });
  }

  // Deletes the row's record after the confirmation; returns what the server said to the DELETE.
  // The confirmation closes once the delete succeeds; after a refused one it stays open.
  async deleteRow(rowText: string): Promise<SaveResult> {
    await this.table.clickRowAction(rowText, 'Delete');
    await this.confirmDialog.expectShown();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (candidate) => candidate.request().method() === 'DELETE' && candidate.url().includes(`${this.list.api}/`),
      ),
      this.confirmDialog.confirm(),
    ]);
    const result = await readSaveResult(response);

    if (result.success) {
      await this.confirmDialog.expectHidden();
    }

    return result;
  }

  async openCreate(): Promise<void> {
    await this.createButton.click();
    await expect(this.page).not.toHaveURL(new RegExp(`${escapeRegExp(this.list.path)}$`));
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
