import { expect, type Locator, type Page } from '@playwright/test';

// The dialog the admin panel shows after a save ("Success", a message and Close) or a refused one
// ("Error", a message and Cancel). It covers the page, even across route changes, until closed. The
// dialog nests one modal in another; the inner one, #modalChild, holds the title, message and button.
export class MessageDialog {
  private readonly dialog: Locator;

  // The delete confirmation uses the same modal; its Ok button tells it apart.
  constructor(page: Page) {
    this.dialog = page
      .locator('#modalChild')
      .filter({ visible: true })
      .filter({ hasNot: page.getByRole('button', { name: 'Ok', exact: true }) });
  }

  async expectShown(title: string, message: string | RegExp): Promise<void> {
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog).toContainText(title);
    await expect(this.dialog).toContainText(message);
  }

  async close(): Promise<void> {
    await this.dialog.getByRole('button', { name: /^(Close|Cancel)$/ }).click();
    await expect(this.dialog).toBeHidden();
  }

  // After a refused save the dialog may or may not show; this leaves the page clear either way.
  async closeIfShown(): Promise<string | undefined> {
    try {
      await this.dialog.waitFor({ state: 'visible', timeout: 3000 });
    } catch {
      return undefined;
    }

    const text = (await this.dialog.innerText()).replace(/\s+/g, ' ').trim();
    await this.close();
    return text;
  }
}
