import { expect, type Locator, type Page } from '@playwright/test';

export class TwoFactorPage {
  // Public so LoginPage can wait for either this screen or the dashboard after submitting.
  readonly heading: Locator;

  private readonly otpInput: Locator;
  private readonly validateButton: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Two factor authentication' });
    this.otpInput = page.getByRole('textbox', { name: 'Enter OTP' });
    this.validateButton = page.getByRole('button', { name: 'Validate' });
  }

  async submitOtp(otp: string): Promise<void> {
    await this.otpInput.fill(otp);
    await this.validateButton.click();
    await expect(this.heading).toBeHidden();
  }
}
