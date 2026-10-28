import { expect, type Locator, type Page } from '@playwright/test';

export class VerifyOtpPage {
  private readonly heading: Locator;
  private readonly otpInput: Locator;
  private readonly validateButton: Locator;
  private readonly errorMessage: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Verify your account' });
    this.otpInput = page.getByRole('textbox', { name: 'Enter OTP' });
    this.validateButton = page.getByRole('button', { name: 'Validate' });
    this.errorMessage = page.locator('[matsnackbarlabel]');
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async submitOtp(otp: string): Promise<void> {
    await this.otpInput.fill(otp);
    await this.validateButton.click();
  }

  async expectInvalidOtpError(): Promise<void> {
    await expect(this.errorMessage).toHaveText('The entered OTP is invalid. Please try again.');
  }
}
