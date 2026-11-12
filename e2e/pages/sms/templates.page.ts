import { expect, type Locator, type Page } from '@playwright/test';
import { ListingComponent, type ListResponse } from '../components/listing.component';

export type TemplateRow = {
  name: string;
};

export class TemplatesPage {
  readonly listing: ListingComponent;

  private readonly heading: Locator;
  private readonly createButton: Locator;

  constructor(page: Page) {
    this.listing = new ListingComponent(page, '/api/v1/sms-templates');

    this.heading = page.getByRole('heading', { name: 'SMS Templates', exact: true });
    this.createButton = page.getByRole('button', { name: 'Create Template' });
  }

  async open(): Promise<ListResponse<TemplateRow>> {
    const templates = await this.listing.open<TemplateRow>('/content-management/sms/templates');
    await this.expectDisplayed();
    return templates;
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async openCreateTemplate(): Promise<void> {
    await this.createButton.click();
  }
}
