import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { appConfig } from '../../../utils/config';
import { AdminSideNav } from '../components/admin-side-nav.component';

// The fields the write specs use; the API returns more for each user.
export type AdminUser = {
  id: number;
  username: string;
  company_name: string;
  full_name: string;
  email: string;
};

// User Onboarding > Users. Only search and the row Edit button are used here, by the specs in
// specs/admin/write/ that edit the users they created.
export class UsersPage {
  readonly sideNav: AdminSideNav;

  private readonly page: Page;
  private readonly heading: Locator;
  private readonly searchInput: Locator;
  private readonly rows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sideNav = new AdminSideNav(page);
    this.heading = page.getByRole('heading', { name: 'Users', exact: true, level: 1 });
    // The search box is an email input with id "email" whose placeholder reads "No Results Found";
    // the user form's Email is a text input, so the type tells them apart.
    this.searchInput = page.locator('input#email[type="email"]');
    // The page also renders a hidden copy of the table; only the visible one is the list.
    this.rows = page.locator('ngx-datatable').filter({ visible: true }).locator('datatable-body-row');
  }

  // A fresh load of the users route lands on Organizations, so it is reached through the side nav.
  async open(): Promise<void> {
    await this.page.goto(new URL('#/organizations/listing', appConfig.adminUrl).toString(), {
      waitUntil: 'domcontentloaded',
    });
    await this.sideNav.openEntry('Users');
    await this.expectDisplayed();
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.page).toHaveURL(/#\/organizations\/user$/);
    await expect(this.heading).toBeVisible();
  }

  // Search runs on Enter, not while typing. Returns the users it loaded, newest first.
  async search(term: string): Promise<AdminUser[]> {
    await this.searchInput.fill(term);
    const [response] = await Promise.all([
      this.page.waitForResponse((candidate) => isUserList(candidate, term)),
      this.searchInput.press('Enter'),
    ]);
    return ((await response.json()) as { data: { items: AdminUser[] } }).data.items;
  }

  // The row with a cell holding just the username. The Edit button's accessible name is its icon
  // font glyph, so it is found by its title.
  async openEdit(username: string): Promise<void> {
    const usernameCell = this.page
      .locator('datatable-body-cell')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(username)}\\s*$`) });
    await this.rows.filter({ has: usernameCell }).getByTitle('Edit', { exact: true }).click();
  }
}

function isUserList(response: Response, queryterm: string): boolean {
  const url = new URL(response.url());

  return (
    response.request().method() === 'GET' &&
    url.pathname.endsWith('/api/v1/users') &&
    (url.searchParams.get('queryterm') ?? '') === queryterm
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
