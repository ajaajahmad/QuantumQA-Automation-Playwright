import { expect, type Locator, type Page } from '@playwright/test';

export type SenderIdDetails = {
  sender: string;
  entityId: string;
  headerId: string;
};

// Also used to edit a sender ID: the app opens the same form, heading included.
export class CreateSenderIdPage {
  private readonly heading: Locator;
  private readonly senderInput: Locator;
  private readonly entityIdInput: Locator;
  private readonly headerIdInput: Locator;
  private readonly saveButton: Locator;
  private readonly cancelButton: Locator;
  private readonly senderRequired: Locator;
  private readonly formError: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Create Sender ID', exact: true });
    this.senderInput = page.locator("input[formcontrolname='sender']");
    this.entityIdInput = page.locator("input[formcontrolname='entity_id']");
    this.headerIdInput = page.locator("input[formcontrolname='dlt_header_id']");
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.senderRequired = page.getByText('Sender should not be empty');
    this.formError = page.locator('[matsnackbarlabel]');
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async enterDetails(details: SenderIdDetails): Promise<void> {
    await this.senderInput.fill(details.sender);
    await this.entityIdInput.fill(details.entityId);
    await this.headerIdInput.fill(details.headerId);
  }

  async enterHeaderId(headerId: string): Promise<void> {
    await this.headerIdInput.fill(headerId);
  }

  async expectDetails(details: SenderIdDetails): Promise<void> {
    await expect(this.senderInput).toHaveValue(details.sender);
    await expect(this.entityIdInput).toHaveValue(details.entityId);
    await expect(this.headerIdInput).toHaveValue(details.headerId);
  }

  async clickSave(): Promise<void> {
    await this.saveButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  async expectRefused(message: string): Promise<void> {
    await expect(this.formError).toHaveText(message);
    await this.expectDisplayed();
  }

  async expectSenderRequiredError(): Promise<void> {
    await expect(this.senderRequired).toBeVisible();
    await expect(this.formError).toHaveText('Please validate the form');
  }
}
