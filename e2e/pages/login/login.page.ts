import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../base.page';

export class LoginPage extends BasePage {
  private readonly usernameInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;

  constructor(page: Page) {
    super(page);
    this.usernameInput = page.locator("//input[@formcontrolname='username']");
    this.passwordInput = page.locator("//input[@formcontrolname='password']");
    this.loginButton = page.locator('button.submit');
  }

  async isDisplayed(): Promise<boolean> {
    return this.usernameInput.isVisible().catch(() => false);
  }

  async enterUsername(username: string): Promise<void> {
    await this.type(this.usernameInput, username);
  }

  async enterPassword(password: string): Promise<void> {
    await this.type(this.passwordInput, password);
  }

  async clickLoginButton(): Promise<void> {
    await this.click(this.loginButton);
  }

  async userLogin(username: string, password: string): Promise<void> {
    if (!username?.trim() || !password?.trim()) {
      throw new Error('Username or Password cannot be empty');
    }

    if (!(await this.isDisplayed())) {
      return;
    }

    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickLoginButton();
    await expect(this.usernameInput).toBeHidden();
  }
}