import { expect, type Locator, type Page } from '@playwright/test';

// The Cancel / Ok confirmation the admin panel shows before deleting a record.
export class ConfirmDialog {
  private readonly dialog: Locator;

  constructor(page: Page) {
    this.dialog = page
      .locator('.modal.show, .swal2-popup, [role="dialog"]')
      .filter({ visible: true })
      .filter({ has: page.getByRole('button', { name: 'Ok', exact: true }) });
  }

  async expectShown(): Promise<void> {
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  }

  async cancel(): Promise<void> {
    await this.dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(this.dialog).toBeHidden();
  }

  async confirm(): Promise<void> {
    await this.dialog.getByRole('button', { name: 'Ok', exact: true }).click();
  }

  async expectHidden(): Promise<void> {
    await expect(this.dialog).toBeHidden();
  }
}
