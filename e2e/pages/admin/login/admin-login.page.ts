import { expect, type Locator, type Page } from '@playwright/test';
import { appConfig } from '../../../utils/config';

// The admin panel's sign-in: username and password, then an OTP that replaces the form on the
// same route. The screen's Forgot Password link is left out on purpose: admin password flows
// are never run.
export class AdminLoginPage {
  private readonly page: Page;
  private readonly usernameInput: Locator;
  private readonly passwordInput: Locator;
  private readonly signInButton: Locator;
  private readonly otpInput: Locator;
  private readonly enterOtpButton: Locator;
  // Errors come from the server and show as red text in the form: one per field, or one for the form.
  private readonly formErrors: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.getByLabel('Username', { exact: true });
    this.passwordInput = page.getByLabel('Password', { exact: true });
    this.signInButton = page.getByRole('button', { name: 'Sign In' });
    // Unlike Username and Password, the OTP label isn't tied to its input.
    this.otpInput = page.locator("input[formcontrolname='otp']");
    this.enterOtpButton = page.getByRole('button', { name: 'Enter OTP' });
    this.formErrors = page.locator('form .text-danger');
  }

  async open(): Promise<void> {
    await this.page.goto(new URL('#/auth/login', appConfig.adminUrl).toString(), { waitUntil: 'domcontentloaded' });
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

  async clickSignIn(): Promise<void> {
    await this.signInButton.click();
  }

  async submitWithEnter(): Promise<void> {
    await this.passwordInput.press('Enter');
  }

  // Stops at the OTP step without submitting an OTP.
  async openOtpStep(username: string, password: string): Promise<void> {
    await this.expectDisplayed();
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickSignIn();
    await expect(this.otpInput).toBeVisible();
  }

  // force: the app inverts aria-disabled on this button (true while idle), and Playwright won't
  // click an element marked disabled. A mouse click works, so this is still what a user can do.
  async submitOtp(otp: string): Promise<void> {
    await this.otpInput.fill(otp);
    await this.enterOtpButton.click({ force: true });
  }

  async login(username: string, password: string, otp: string): Promise<void> {
    await this.openOtpStep(username, password);
    await this.submitOtp(otp);

    // A refused OTP keeps the form open with the server's message, e.g. "OTP Not Verified".
    await expect(this.page, 'admin login should leave the auth pages').not.toHaveURL(/#\/auth\//);
  }

  async expectEmptyUsernameError(): Promise<void> {
    await expect(this.formErrors.filter({ hasText: 'Username should not be empty' })).toBeVisible();
  }

  async expectEmptyPasswordError(): Promise<void> {
    await expect(this.formErrors.filter({ hasText: 'Password should not be empty' })).toBeVisible();
  }

  async expectInvalidCredentialsError(): Promise<void> {
    await expect(this.formErrors).toHaveText(['Username or password incorrect']);
  }

  async expectLoggedOut(): Promise<void> {
    await this.expectDisplayed();
    await expect(this.page).toHaveURL(/#\/auth\/login$/);
  }
}
