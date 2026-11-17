import type { Locator, Page } from '@playwright/test';

// The bar above every admin page. Its profile menu holds a single item, Sign out.
export class AdminHeader {
  private readonly profileButton: Locator;
  private readonly signOutItem: Locator;

  constructor(page: Page) {
    // The avatar that opens the menu has no alt text or label to find it by.
    this.profileButton = page.locator('.user.dropdown img.dropdown-toggle');
    this.signOutItem = page.getByRole('button', { name: 'Sign out', exact: true });
  }

  async signOut(): Promise<void> {
    await this.profileButton.click();
    await this.signOutItem.click();
  }
}
