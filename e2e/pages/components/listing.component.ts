import { expect, type Locator, type Page } from '@playwright/test';
import { appConfig } from '../../utils/config';
import { DeleteConfirmationDialog } from './delete-confirmation.dialog';

// One page of a list endpoint, as the list pages load it.
export type ListResponse<T> = {
  docs: T[];
  total: number;
};

// The searchable, paged table shared by the SMS Sender IDs, Templates and Campaigns pages.
export class ListingComponent {
  readonly deleteConfirmationDialog: DeleteConfirmationDialog;

  private readonly searchInput: Locator;
  private readonly pageSizeSelect: Locator;
  private readonly rows: Locator;
  private readonly noRecords: Locator;
  private readonly totalRecords: Locator;

  // apiPath is the GET endpoint that fills the table, e.g. /api/v1/sms-senders.
  constructor(
    private readonly page: Page,
    private readonly apiPath: string,
  ) {
    this.deleteConfirmationDialog = new DeleteConfirmationDialog(page);

    this.searchInput = page.locator('input.filter-search');
    this.pageSizeSelect = page.locator('select.custom-show-entries');
    this.rows = page.locator('tbody tr');
    this.noRecords = page.getByText('No records found');
    this.totalRecords = page.getByText(/Total Records :-/);
  }

  // Opens the page and returns the list response the table was built from, so tests can
  // compare against it without hard-coding this account's data.
  async open<T>(path: string): Promise<ListResponse<T>> {
    const response = this.page.waitForResponse(
      (candidate) =>
        new URL(candidate.url()).pathname === this.apiPath && candidate.request().method() === 'GET',
    );
    await this.page.goto(new URL(path, appConfig.appUrl).toString(), { waitUntil: 'domcontentloaded' });

    const body = await (await response).json();
    return (body.data ?? body) as ListResponse<T>;
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.searchInput.press('Enter');
  }

  async setPageSize(size: number): Promise<void> {
    const request = this.page.waitForRequest(
      (candidate) =>
        new URL(candidate.url()).pathname === this.apiPath &&
        new URL(candidate.url()).searchParams.get('limit') === String(size),
    );
    await this.pageSizeSelect.selectOption(String(size));
    await request;
  }

  async expectRowCount(count: number): Promise<void> {
    await expect(this.rows).toHaveCount(count);
  }

  async expectTotalRecords(total: number): Promise<void> {
    await expect(this.totalRecords).toHaveText(new RegExp(`Total Records :-\\s*${total}\\b`));
  }

  async expectColumns(columns: string[]): Promise<void> {
    for (const column of columns) {
      await expect(this.page.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
    }
  }

  // Case-insensitive, matching how the app's search behaves.
  async expectEveryRowToContain(text: string): Promise<void> {
    await expect(this.noRecords).toBeHidden();
    await expect(this.rows.first()).toContainText(text, { ignoreCase: true });
    for (const row of await this.rows.all()) {
      await expect(row).toContainText(text, { ignoreCase: true });
    }
  }

  async expectNoRecords(): Promise<void> {
    await expect(this.noRecords).toBeVisible();
  }

  // Searches for the row first, so it is on the current page whatever the list size.
  async expectRow(name: string, cells: string[]): Promise<void> {
    await this.search(name);
    const row = this.row(name);
    for (const cell of cells) {
      await expect(row).toContainText(cell);
    }
  }

  async openEdit(name: string): Promise<void> {
    await this.search(name);
    await this.row(name).locator('.icon-edit-1').click();
  }

  async delete(name: string): Promise<void> {
    await this.search(name);
    await this.row(name).locator('.icon-Delete').click();
    await this.deleteConfirmationDialog.confirm();
  }

  // Matches the whole name cell, so "QA1" doesn't also match "QA12".
  private row(name: string): Locator {
    return this.rows.filter({ has: this.page.getByText(name, { exact: true }) });
  }
}
