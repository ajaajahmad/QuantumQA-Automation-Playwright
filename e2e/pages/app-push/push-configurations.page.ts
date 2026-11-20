import { expect, type Locator, type Page } from '@playwright/test';
import { appConfig } from '../../utils/config';

// One integration as GET app-push-configurations returns it. created_by and updated_by hold the
// users' login names there (the options endpoint gives ids instead).
export type PushConfiguration = {
  id: number;
  app_name: string;
  service_provider: string;
  certificate_type: string;
  is_active: number;
  created_by: string;
  updated_by: string;
};

// APP Push > Configurations: the apps (FCM projects) the account can push through.
export class PushConfigurationsPage {
  private readonly heading: Locator;
  private readonly createButton: Locator;
  private readonly headers: Locator;
  private readonly rows: Locator;
  private readonly totalRecords: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByText('App Push Integration', { exact: true });
    this.createButton = page.getByText('Create Integration', { exact: true });
    this.headers = page.locator('thead th');
    this.rows = page.locator('tbody tr');
    this.totalRecords = page.getByText(/Total Records :-/);
  }

  async open(): Promise<{ docs: PushConfiguration[]; total: number }> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (candidate) =>
          candidate.request().method() === 'GET' && new URL(candidate.url()).pathname.endsWith('/api/v1/app-push-configurations'),
      ),
      this.page.goto(new URL('/integration/app-push/listing', appConfig.appUrl).toString(), { waitUntil: 'domcontentloaded' }),
    ]);
    await expect(this.heading).toBeVisible();
    const { data } = (await response.json()) as { data: { docs: PushConfiguration[]; total?: number; totalDocs?: number } };
    return { docs: data.docs, total: data.total ?? data.totalDocs ?? data.docs.length };
  }

  async expectColumns(columns: string[]): Promise<void> {
    await expect(this.headers).toHaveText(columns);
  }

  // Name, provider, certificates, Active or Inactive, created by and updated by, per row.
  async expectRowsOf(list: { docs: PushConfiguration[]; total: number }): Promise<void> {
    await expect(this.rows).toHaveCount(list.docs.length);
    await expect(this.totalRecords).toHaveText(new RegExp(`Total Records :-\\s*${list.total}\\b`));

    for (const [index, configuration] of list.docs.entries()) {
      await expect(this.rows.nth(index).locator('td').nth(0)).toHaveText(configuration.app_name);
      await expect(this.rows.nth(index).locator('td').nth(1)).toHaveText(configuration.service_provider);
      await expect(this.rows.nth(index).locator('td').nth(2)).toHaveText(configuration.certificate_type);
      await expect(this.rows.nth(index).locator('td').nth(3)).toHaveText(configuration.is_active ? 'Active' : 'Inactive');
      await expect(this.rows.nth(index).locator('td').nth(4)).toHaveText(configuration.created_by);
      await expect(this.rows.nth(index).locator('td').nth(5)).toHaveText(configuration.updated_by);
    }
  }

  // The row's action icons, by title.
  async actions(appName: string): Promise<string[]> {
    const row = this.rows.filter({ has: this.page.getByText(appName, { exact: true }) });
    const titles = await row.locator('td').last().locator('[title]').evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('title') ?? ''),
    );
    return [...new Set(titles)];
  }

  async openCreate(): Promise<void> {
    await this.createButton.click();
    await expect(this.page).toHaveURL(/\/integration\/app-push\/create$/);
  }
}
