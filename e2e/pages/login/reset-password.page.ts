import { expect, type Locator, type Page } from '@playwright/test';

export class ResetPasswordPage {
  private readonly heading: Locator;
  private readonly newPasswordInput: Locator;
  private readonly confirmPasswordInput: Locator;
  private readonly resetButton: Locator;
  private readonly invalidPasswordError: Locator;
  private readonly mismatchError: Locator;
  private readonly errorMessage: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Reset your password' });
    this.newPasswordInput = page.getByRole('textbox', { name: 'New Password', exact: true });
    this.confirmPasswordInput = page.getByRole('textbox', { name: 'Confirm Password', exact: true });
    this.resetButton = page.getByRole('button', { name: 'Reset' });
    this.invalidPasswordError = page.getByText('Password is invalid');
    this.mismatchError = page.getByText('Password must match');
    this.errorMessage = page.locator('[matsnackbarlabel]');
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  // Leaves the confirm field afterwards: the app only checks for a mismatch on blur.
  async enterPasswords(newPassword: string, confirmPassword: string): Promise<void> {
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.confirmPasswordInput.press('Tab');
  }

  async clickReset(): Promise<void> {
    await this.resetButton.click();
  }

  async expectInvalidPasswordError(): Promise<void> {
    await expect(this.invalidPasswordError).toBeVisible();
  }

  // The field is flagged on blur, but the message only shows after Reset.
  async expectConfirmPasswordFlagged(): Promise<void> {
    await expect(this.confirmPasswordInput).toHaveAttribute('aria-invalid', 'true');
  }

  async expectMismatchError(): Promise<void> {
    await expect(this.mismatchError).toBeVisible();
  }

  async expectPasswordReuseError(): Promise<void> {
    await expect(this.errorMessage).toHaveText('Your new password cannot be same as last 3 passwords');
  }
}
