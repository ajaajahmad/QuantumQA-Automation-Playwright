import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class LoginErrorPage extends BasePage {
  private readonly usernameRequired: Locator;
  private readonly passwordRequired: Locator;
  private readonly loginErrorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.usernameRequired = page.locator("//span[contains(text(),'Username is required')]");
    this.passwordRequired = page.locator("//span[contains(text(),'Password is required')]");
    this.loginErrorMessage = page.locator("div[class*='snack-bar-label']");
  }

  async expectEmptyUsernameError(): Promise<void> {
    await expect(this.usernameRequired).toHaveText('Username is required');
  }

  async expectEmptyPasswordError(): Promise<void> {
    await expect(this.passwordRequired).toHaveText('Password is required');
  }

  async expectInvalidCredentialsError(): Promise<void> {
    await expect(this.loginErrorMessage).toHaveText('Combination of username and password is incorrect.');
  }
}
