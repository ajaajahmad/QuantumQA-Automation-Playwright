import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class LogoutComponent extends BasePage {
  private readonly profileIcon: Locator;
  private readonly logoutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.profileIcon = page.locator('.user-name-alias');
    this.logoutButton = page.locator("//a[normalize-space()='Logout']");
  }

  async userLogout(): Promise<void> {
    await this.click(this.profileIcon);
    await this.click(this.logoutButton);
  }
}
