import type { Locator, Page } from '@playwright/test';

export class LogoutComponent {
  private readonly profileIcon: Locator;
  private readonly logoutButton: Locator;

  constructor(page: Page) {
    this.profileIcon = page.locator('.user-name-alias');
    this.logoutButton = page.locator("//a[normalize-space()='Logout']");
  }

  async userLogout(): Promise<void> {
    await this.profileIcon.click();
    await this.logoutButton.click();
  }
}
