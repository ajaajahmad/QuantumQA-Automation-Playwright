import { expect, type Locator, type Page } from '@playwright/test';
import type { ForgotPasswordAccount } from '../../utils/test-data';
import { ResetPasswordPage } from './reset-password.page';
import { VerifyOtpPage } from './verify-otp.page';

export class ForgotPasswordPage {
  readonly verifyOtpPage: VerifyOtpPage;
  readonly resetPasswordPage: ResetPasswordPage;

  private readonly heading: Locator;
  private readonly usernameInput: Locator;
  private readonly mobileLast4Input: Locator;
  private readonly confirmButton: Locator;
  private readonly cancelButton: Locator;
  private readonly usernameRequired: Locator;
  private readonly mobileRequired: Locator;
  private readonly mobileInvalid: Locator;
  private readonly errorMessage: Locator;

  constructor(page: Page) {
    this.verifyOtpPage = new VerifyOtpPage(page);
    this.resetPasswordPage = new ResetPasswordPage(page);

    this.heading = page.getByRole('heading', { name: 'Forgot Password' });
    this.usernameInput = page.getByRole('textbox', { name: 'Username', exact: true });
    this.mobileLast4Input = page.getByRole('textbox', { name: 'Enter last 4 digit of mobile number' });
    this.confirmButton = page.getByRole('button', { name: 'Confirm' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.usernameRequired = page.getByText('Username is required');
    this.mobileRequired = page.getByText('Mobile is required');
    // Too-short digits fail two validators, and the app prints this message once for each.
    this.mobileInvalid = page.getByText('Mobile is invalid').first();
    this.errorMessage = page.locator('[matsnackbarlabel]');
  }

  async reachResetPasswordScreen(account: ForgotPasswordAccount): Promise<void> {
    await this.requestOtp(account.username, account.mobileLast4);
    await this.verifyOtpPage.expectDisplayed();
    await this.verifyOtpPage.submitOtp(account.otp);
    await this.resetPasswordPage.expectDisplayed();
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async requestOtp(username: string, mobileLast4: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.enterMobileLast4(mobileLast4);
    await this.clickConfirm();
  }

  async enterMobileLast4(mobileLast4: string): Promise<void> {
    await this.mobileLast4Input.fill(mobileLast4);
  }

  async clickConfirm(): Promise<void> {
    await this.confirmButton.click();
  }

  // Unlike the OTP and reset screens, this one goes back without asking.
  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  async expectRequiredFieldErrors(): Promise<void> {
    await expect(this.usernameRequired).toBeVisible();
    await expect(this.mobileRequired).toBeVisible();
  }

  async expectUsernameRequiredError(): Promise<void> {
    await expect(this.usernameRequired).toBeVisible();
    await expect(this.mobileRequired).toBeHidden();
  }

  async expectMobileLast4Value(value: string): Promise<void> {
    await expect(this.mobileLast4Input).toHaveValue(value);
  }

  async expectInvalidMobileError(): Promise<void> {
    await expect(this.mobileInvalid).toBeVisible();
  }

  // The app shows the same message for a wrong username and for wrong digits.
  async expectInvalidCombinationError(): Promise<void> {
    await expect(this.errorMessage).toHaveText(
      'The combination of username and digits entered is invalid. Please try again.',
    );
  }
}
