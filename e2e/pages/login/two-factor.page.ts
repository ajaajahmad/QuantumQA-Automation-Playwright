import { expect, type Locator, type Page } from '@playwright/test';
import { CancelConfirmationDialog } from './cancel-confirmation.dialog';

export class TwoFactorPage {
  // Public so LoginPage can wait for either this screen or the dashboard after submitting.
  readonly heading: Locator;
  readonly cancelConfirmationDialog: CancelConfirmationDialog;

  private readonly otpInput: Locator;
  private readonly validateButton: Locator;
  private readonly cancelButton: Locator;
  private readonly errorMessage: Locator;

  constructor(page: Page) {
    this.cancelConfirmationDialog = new CancelConfirmationDialog(page);

    this.heading = page.getByRole('heading', { name: 'Two factor authentication' });
    this.otpInput = page.getByRole('textbox', { name: 'Enter OTP' });
    this.validateButton = page.getByRole('button', { name: 'Validate' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.errorMessage = page.locator('[matsnackbarlabel]');
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async validateOtp(otp: string): Promise<void> {
    await this.otpInput.fill(otp);
    await this.validateButton.click();
  }

  async submitOtp(otp: string): Promise<void> {
    await this.validateOtp(otp);
    await expect(this.heading).toBeHidden();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.cancelConfirmationDialog.confirm();
  }

  async expectInvalidOtpError(): Promise<void> {
    await expect(this.errorMessage).toHaveText('The entered OTP is invalid. Please try again.');
  }
}
