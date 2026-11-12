import { expect, type Locator, type Page } from '@playwright/test';

// Asked before deleting a row from the SMS lists.
export class DeleteConfirmationDialog {
  private readonly dialog: Locator;
  private readonly confirmButton: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog').filter({ hasText: 'Do you want to delete?' });
    this.confirmButton = this.dialog.getByRole('button', { name: 'Confirm' });
  }

  async confirm(): Promise<void> {
    await expect(this.dialog).toContainText('Deleting record is permanent');
    await this.confirmButton.click();
    await expect(this.dialog).toBeHidden();
  }
}
