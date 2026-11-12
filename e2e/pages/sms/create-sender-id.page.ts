import { expect, type Locator, type Page } from '@playwright/test';

// Only the parts the regression tests touch: an empty Save and Cancel. Nothing here creates
// a sender ID.
export class CreateSenderIdPage {
  private readonly heading: Locator;
  private readonly saveButton: Locator;
  private readonly cancelButton: Locator;
  private readonly senderRequired: Locator;
  private readonly formError: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Create Sender ID', exact: true });
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.senderRequired = page.getByText('Sender should not be empty');
    this.formError = page.locator('[matsnackbarlabel]');
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async clickSave(): Promise<void> {
    await this.saveButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  async expectSenderRequiredError(): Promise<void> {
    await expect(this.senderRequired).toBeVisible();
    await expect(this.formError).toHaveText('Please validate the form');
  }
}
