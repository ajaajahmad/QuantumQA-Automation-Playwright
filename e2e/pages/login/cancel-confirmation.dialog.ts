import { expect, type Locator, type Page } from '@playwright/test';

// Asked before leaving the OTP and reset-password screens.
export class CancelConfirmationDialog {
  private readonly dialog: Locator;
  private readonly confirmButton: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog');
    this.confirmButton = this.dialog.getByRole('button', { name: 'Confirm' });
  }

  async confirm(): Promise<void> {
    await expect(this.dialog).toContainText('Are you sure you want to cancel ?');
    await this.confirmButton.click();
    await expect(this.dialog).toBeHidden();
  }
}
