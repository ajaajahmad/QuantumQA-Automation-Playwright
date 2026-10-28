import { expect, type Locator, type Page } from '@playwright/test';

export class ResetPasswordPage {
  private readonly heading: Locator;
  private readonly newPasswordInput: Locator;
  private readonly confirmPasswordInput: Locator;
  private readonly resetButton: Locator;
  private readonly invalidPasswordError: Locator;
  private readonly mismatchError: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Reset your password' });
    this.newPasswordInput = page.getByRole('textbox', { name: 'New Password', exact: true });
    this.confirmPasswordInput = page.getByRole('textbox', { name: 'Confirm Password', exact: true });
    this.resetButton = page.getByRole('button', { name: 'Reset' });
    this.invalidPasswordError = page.getByText('Password is invalid');
    this.mismatchError = page.getByText('Password must match');
  }

  async reset(newPassword: string): Promise<void> {
    await this.enterPasswords(newPassword, newPassword);
    await this.clickReset();
    await expect(this.resetButton).toBeHidden();
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async enterPasswords(newPassword: string, confirmPassword: string): Promise<void> {
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(confirmPassword);
  }

  async clickReset(): Promise<void> {
    await this.resetButton.click();
  }

  async expectInvalidPasswordError(): Promise<void> {
    await expect(this.invalidPasswordError).toBeVisible();
  }

  // The field is flagged as soon as it differs, but the message only shows after Reset.
  async expectConfirmPasswordFlagged(): Promise<void> {
    await expect(this.confirmPasswordInput).toHaveAttribute('aria-invalid', 'true');
  }

  async expectMismatchError(): Promise<void> {
    await expect(this.mismatchError).toBeVisible();
  }
}
