import { expect, type Locator, type Page } from '@playwright/test';
import { ListingComponent, type ListResponse } from '../components/listing.component';

export type SenderIdRow = {
  sender: string;
};

export class SenderIdsPage {
  readonly listing: ListingComponent;

  private readonly heading: Locator;
  private readonly createButton: Locator;
  private readonly notification: Locator;

  constructor(page: Page) {
    this.listing = new ListingComponent(page, '/api/v1/sms-senders');

    this.heading = page.getByRole('heading', { name: 'Sender IDs', exact: true });
    this.createButton = page.getByRole('button', { name: 'Create Sender ID' });
    // The previous snackbar can still be fading out, so read the newest one.
    this.notification = page.locator('[matsnackbarlabel]').last();
  }

  async open(): Promise<ListResponse<SenderIdRow>> {
    const senders = await this.listing.open<SenderIdRow>('/content-management/sms/sender-ids');
    await this.expectDisplayed();
    return senders;
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async openCreateSenderId(): Promise<void> {
    await this.createButton.click();
  }

  // Saving or deleting returns here and shows the outcome in a snackbar.
  async expectNotification(message: string): Promise<void> {
    await expect(this.notification).toHaveText(message);
    await this.expectDisplayed();
  }
}
