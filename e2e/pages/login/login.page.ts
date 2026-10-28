import { expect, type Locator, type Page } from '@playwright/test';

export class LoginPage {
  private readonly usernameInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;
  private readonly forgotPasswordLink: Locator;
  private readonly usernameRequired: Locator;
  private readonly passwordRequired: Locator;
  private readonly loginErrorMessage: Locator;

  constructor(page: Page) {
    this.usernameInput = page.locator("//input[@formcontrolname='username']");
    this.passwordInput = page.locator("//input[@formcontrolname='password']");
    this.loginButton = page.locator('button.submit');
    this.forgotPasswordLink = page.getByText('Forgot Password ?');
    this.usernameRequired = page.locator("//span[contains(text(),'Username is required')]");
    this.passwordRequired = page.locator("//span[contains(text(),'Password is required')]");
    this.loginErrorMessage = page.locator('[matsnackbarlabel]');
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.usernameInput).toBeVisible();
  }

  async expectHidden(): Promise<void> {
    await expect(this.usernameInput).toBeHidden();
  }

  async enterUsername(username: string): Promise<void> {
    await this.usernameInput.fill(username);
  }

  async enterPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async clickLoginButton(): Promise<void> {
    await this.loginButton.click();
  }

  async openForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
  }

  async userLogin(username: string, password: string): Promise<void> {
    if (!username?.trim() || !password?.trim()) {
      throw new Error('Username or Password cannot be empty');
    }

    await this.expectDisplayed();
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickLoginButton();
    await this.expectHidden();
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
