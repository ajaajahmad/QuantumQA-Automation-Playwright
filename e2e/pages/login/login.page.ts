import { expect, type Locator, type Page } from '@playwright/test';
import { TwoFactorPage } from './two-factor.page';

export class LoginPage {
  readonly twoFactorPage: TwoFactorPage;

  private readonly usernameInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;
  private readonly loggedInProfileIcon: Locator;
  private readonly forgotPasswordLink: Locator;
  private readonly usernameRequired: Locator;
  private readonly passwordRequired: Locator;
  private readonly loginErrorMessage: Locator;

  constructor(page: Page) {
    this.twoFactorPage = new TwoFactorPage(page);

    this.usernameInput = page.locator("//input[@formcontrolname='username']");
    this.passwordInput = page.locator("//input[@formcontrolname='password']");
    this.loginButton = page.locator('button.submit');
    this.loggedInProfileIcon = page.locator('.user-name-alias');
    this.forgotPasswordLink = page.getByText('Forgot Password ?');
    this.usernameRequired = page.locator("//span[contains(text(),'Username is required')]");
    this.passwordRequired = page.locator("//span[contains(text(),'Password is required')]");
    this.loginErrorMessage = page.locator('[matsnackbarlabel]');
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.usernameInput).toBeVisible();
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

  // otp is only needed when the user has two-factor authentication on.
  async userLogin(username: string, password: string, otp?: string): Promise<void> {
    if (!username?.trim() || !password?.trim()) {
      throw new Error('Username or Password cannot be empty');
    }

    await this.expectDisplayed();
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickLoginButton();

    await expect(this.loggedInProfileIcon.or(this.twoFactorPage.heading)).toBeVisible();

    if (await this.twoFactorPage.heading.isVisible()) {
      if (!otp?.trim()) {
        throw new Error(`Two-factor authentication is on for ${username}: add one_time_password to its userdata.json row.`);
      }

      await this.twoFactorPage.submitOtp(otp);
    }

    await expect(this.loggedInProfileIcon).toBeVisible();
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
