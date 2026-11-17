import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { appConfig } from '../../../utils/config';

// The fields the listing shows; the API returns more for each organization.
export type Organization = {
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  country: string | null;
};

export type OrganizationList = {
  items: Organization[];
  meta: { totalItems: number; itemCount: number; itemsPerPage: number; totalPages: number; currentPage: number };
};

// The admin home page: every organization, ten to a page, with a search box. The Create
// Organization and row Edit buttons are left out on purpose: admin specs are read-only.
export class OrganizationsPage {
  private readonly page: Page;
  private readonly heading: Locator;
  private readonly searchInput: Locator;
  private readonly rows: Locator;
  private readonly totalCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Organizations', level: 1 });
    this.searchInput = page.getByPlaceholder('Company Name, Contact Person, Email, Country');
    // The page also renders a hidden copy of the table; only the visible one is the listing.
    const table = page.locator('ngx-datatable').filter({ visible: true });
    this.rows = table.locator('datatable-body-row');
    this.totalCount = table.locator('datatable-footer .page-count');
  }

  // Returns the list the page loaded, so checks compare against what the API sent.
  async open(): Promise<OrganizationList> {
    const list = await this.waitForList('', () =>
      this.page.goto(new URL('#/organizations/listing', appConfig.adminUrl).toString(), {
        waitUntil: 'domcontentloaded',
      }),
    );
    await this.expectDisplayed();
    return list;
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.page).toHaveURL(/#\/organizations\/listing$/);
    await expect(this.heading).toBeVisible();
    await expect(this.searchInput).toBeVisible();
  }

  // Search runs on Enter, not while typing. Returns the list the search loaded.
  async search(term: string): Promise<OrganizationList> {
    await this.searchInput.fill(term);
    return this.waitForList(term, () => this.searchInput.press('Enter'));
  }

  // The rows in the order the API sent them, by company name, and the total under the table.
  async expectListShown(list: OrganizationList): Promise<void> {
    await expect(this.rows).toHaveCount(list.items.length);

    for (const [index, organization] of list.items.entries()) {
      await expect(this.rows.nth(index).locator('datatable-body-cell').first()).toHaveText(organization.company_name ?? '');
    }

    await expect(this.totalCount).toHaveText(`${list.meta.totalItems} total`);
  }

  // Search matches the company name, contact person, email or country, all of which the row shows.
  async expectEveryRowContains(term: string): Promise<void> {
    const count = await this.rows.count();
    expect(count, 'the search should find at least one organization').toBeGreaterThan(0);

    for (let index = 0; index < count; index++) {
      await expect(this.rows.nth(index)).toContainText(term, { ignoreCase: true });
    }
  }

  private async waitForList(queryterm: string, action: () => Promise<unknown>): Promise<OrganizationList> {
    const [response] = await Promise.all([
      this.page.waitForResponse((candidate) => isOrganizationList(candidate, queryterm)),
      action(),
    ]);

    return ((await response.json()) as { data: OrganizationList }).data;
  }
}

function isOrganizationList(response: Response, queryterm: string): boolean {
  const url = new URL(response.url());

  return (
    response.request().method() === 'GET' &&
    url.pathname.endsWith('/api/v1/organizations') &&
    (url.searchParams.get('queryterm') ?? '') === queryterm
  );
}
