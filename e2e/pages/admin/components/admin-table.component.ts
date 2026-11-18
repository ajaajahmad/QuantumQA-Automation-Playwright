import { expect, type Locator, type Page, type Response } from '@playwright/test';
import type { AdminListBody } from '../../../utils/admin-api';

export type LoadedList<T> = AdminListBody<T> & { query: URLSearchParams };

// The paged ngx-datatable the Admin group's lists share (Admin Users, Role Permissions, Sales
// Users). Each list comes from one GET endpoint that also returns the table's column settings, so
// the checks compare the table against what the API sent rather than against fixed data.
export class AdminTable {
  private readonly page: Page;
  private readonly apiPath: string;
  private readonly headers: Locator;
  private readonly rows: Locator;
  private readonly emptyRow: Locator;
  private readonly totalCount: Locator;
  private readonly pager: Locator;

  // apiPath is the end of the list endpoint's path, e.g. /api/v1/roles.
  constructor(page: Page, apiPath: string) {
    this.page = page;
    this.apiPath = apiPath;
    // Some pages also render hidden tables (a date picker's calendar); only the visible list counts.
    const table = page.locator('ngx-datatable').filter({ visible: true });
    this.headers = table.locator('datatable-header-cell');
    this.rows = table.locator('datatable-body-row');
    this.emptyRow = table.locator('.empty-row');
    this.totalCount = table.locator('datatable-footer .page-count');
    this.pager = table.locator('datatable-pager');
  }

  // Runs the action and returns the list it loaded, with the query it was asked for. Each given
  // query parameter must match, so a response to an earlier request is never taken for this one.
  async load<T>(action: () => Promise<unknown>, params: Record<string, string> = {}): Promise<LoadedList<T>> {
    const [response] = await Promise.all([
      this.page.waitForResponse((candidate) => this.isList(candidate, params)),
      action(),
    ]);
    const body = (await response.json()) as AdminListBody<T>;
    return { ...body, query: new URL(response.url()).searchParams };
  }

  // The headers are the API's visible columns, in its order.
  async expectColumnsOf(body: AdminListBody<unknown>): Promise<void> {
    await expect(this.headers).toHaveText(body.columns.filter((column) => column.visible).map((column) => column.name.trim()));
  }

  // Each row shows its record's values in the visible columns; the API sends them display-ready.
  async expectRowsOf(body: AdminListBody<unknown>): Promise<void> {
    const columns = body.columns.filter((column) => column.visible && column.prop !== 'Actions');
    await expect(this.rows).toHaveCount(body.data.items.length);

    for (const [index, item] of body.data.items.entries()) {
      const cells = this.rows.nth(index).locator('datatable-body-cell');
      const record = item as Record<string, unknown>;

      for (const [position, column] of columns.entries()) {
        await expect(cells.nth(position), `row ${index + 1}, ${column.name}`).toHaveText(String(record[column.prop] ?? ''));
      }
    }
  }

  // The footer formats the total with comma thousands separators, e.g. 1,027 total.
  async expectTotal(total: number): Promise<void> {
    await expect(this.totalCount).toHaveText(`${total.toLocaleString('en-US')} total`);
  }

  async expectEmpty(): Promise<void> {
    await expect(this.rows).toHaveCount(0);
    await expect(this.emptyRow).toBeVisible();
  }

  // Sorting runs on the server and restarts at page 1. The first click sorts ascending; later
  // clicks switch between descending and ascending.
  async sortBy<T>(header: string, order: 'asc' | 'desc'): Promise<LoadedList<T>> {
    const sortButton = this.header(header).locator('.sort-btn');
    return this.load<T>(() => sortButton.click(), { sort: header.toLowerCase(), order });
  }

  async expectSorted(header: string, order: 'asc' | 'desc'): Promise<void> {
    await expect(this.header(header).locator('.sort-btn')).toHaveClass(new RegExp(`\\bsort-${order}\\b`));
  }

  // The pager's links are named for screen readers: go to next page, page 2 and so on.
  async goToPage<T>(target: 'first' | 'previous' | 'next' | 'last' | number): Promise<LoadedList<T>> {
    const link =
      typeof target === 'number'
        ? this.pager.getByRole('button', { name: `page ${target}`, exact: true })
        : this.pager.getByRole('button', { name: `go to ${target} page`, exact: true });
    return this.load<T>(() => link.click());
  }

  async expectCurrentPage(pageNumber: number): Promise<void> {
    await expect(this.pager.locator('li.pages.active')).toHaveText(String(pageNumber));
  }

  async clickRowAction(rowText: string, title: string): Promise<void> {
    await this.row(rowText).getByTitle(title, { exact: true }).click();
  }

  async expectRowAction(rowText: string, title: string, enabled: boolean): Promise<void> {
    const button = this.row(rowText).getByTitle(title, { exact: true });
    await (enabled ? expect(button).toBeEnabled() : expect(button).toBeDisabled());
  }

  // By position, for checks that go through every row or only need some record from the list.
  async clickActionAt(index: number, title: string): Promise<void> {
    await this.rows.nth(index).getByTitle(title, { exact: true }).click();
  }

  async expectActionAt(index: number, title: string, enabled: boolean): Promise<void> {
    const button = this.rows.nth(index).getByTitle(title, { exact: true });
    await (enabled ? expect(button).toBeEnabled() : expect(button).toBeDisabled());
  }

  async expectActions(index: number, titles: string[]): Promise<void> {
    await expect(this.rows.nth(index).locator('button')).toHaveCount(titles.length);

    for (const [position, title] of titles.entries()) {
      await expect(this.rows.nth(index).locator('button').nth(position)).toHaveAttribute('title', title);
    }
  }

  // The row with a cell holding exactly the text, such as a username, role name or email.
  private row(text: string): Locator {
    const cell = this.page.locator('datatable-body-cell').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`) });
    return this.rows.filter({ has: cell });
  }

  private header(name: string): Locator {
    return this.headers.filter({ hasText: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`) });
  }

  private isList(response: Response, params: Record<string, string>): boolean {
    const url = new URL(response.url());

    return (
      response.request().method() === 'GET' &&
      url.pathname.endsWith(this.apiPath) &&
      Object.entries(params).every(([key, value]) => (url.searchParams.get(key) ?? '') === value)
    );
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
