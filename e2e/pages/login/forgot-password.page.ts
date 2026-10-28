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
  private readonly usernameRequired: Locator;
  private readonly mobileRequired: Locator;
  private readonly errorMessage: Locator;

  constructor(page: Page) {
    this.verifyOtpPage = new VerifyOtpPage(page);
    this.resetPasswordPage = new ResetPasswordPage(page);

    this.heading = page.getByRole('heading', { name: 'Forgot Password' });
    this.usernameInput = page.getByRole('textbox', { name: 'Username', exact: true });
    this.mobileLast4Input = page.getByRole('textbox', { name: 'Enter last 4 digit of mobile number' });
    this.confirmButton = page.getByRole('button', { name: 'Confirm' });
    this.usernameRequired = page.getByText('Username is required');
    this.mobileRequired = page.getByText('Mobile is required');
    this.errorMessage = page.locator('[matsnackbarlabel]');
  }

  async resetPassword(account: ForgotPasswordAccount, newPassword: string): Promise<void> {
    await this.reachResetPasswordScreen(account);
    await this.resetPasswordPage.reset(newPassword);
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
    await this.mobileLast4Input.fill(mobileLast4);
    await this.clickConfirm();
  }

  async clickConfirm(): Promise<void> {
    await this.confirmButton.click();
  }

  async expectRequiredFieldErrors(): Promise<void> {
    await expect(this.usernameRequired).toBeVisible();
    await expect(this.mobileRequired).toBeVisible();
  }

  async expectInvalidMobileDigitsError(): Promise<void> {
    await expect(this.errorMessage).toHaveText(
      'The combination of username and digits entered is invalid. Please try again.',
    );
  }
}
