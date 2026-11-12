import { expect, type Locator, type Page } from '@playwright/test';
import { CancelConfirmationDialog } from './cancel-confirmation.dialog';

export class ResetPasswordPage {
  readonly cancelConfirmationDialog: CancelConfirmationDialog;

  private readonly heading: Locator;
  private readonly newPasswordInput: Locator;
  private readonly confirmPasswordInput: Locator;
  private readonly newPasswordVisibilityToggle: Locator;
  private readonly resetButton: Locator;
  private readonly cancelButton: Locator;
  private readonly invalidPasswordError: Locator;
  private readonly mismatchError: Locator;
  private readonly maxLengthError: Locator;
  private readonly newPasswordRequired: Locator;
  private readonly confirmPasswordRequired: Locator;
  private readonly successMessage: Locator;
  private readonly errorMessage: Locator;

  constructor(page: Page) {
    this.cancelConfirmationDialog = new CancelConfirmationDialog(page);

    this.heading = page.getByRole('heading', { name: 'Reset your password' });
    this.newPasswordInput = page.getByRole('textbox', { name: 'New Password', exact: true });
    this.confirmPasswordInput = page.getByRole('textbox', { name: 'Confirm Password', exact: true });
    // Its accessible name stays 'Hide password' whichever state it is in.
    this.newPasswordVisibilityToggle = page.getByRole('button', { name: 'Hide password' });
    this.resetButton = page.getByRole('button', { name: 'Reset' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.invalidPasswordError = page.getByText('Password is invalid');
    this.mismatchError = page.getByText('Password must match');
    this.maxLengthError = page.getByText('Password should have maximum 20 character');
    this.newPasswordRequired = page.getByText('Password is required', { exact: true });
    // The app spells it 'Pasword'; accept either so fixing the typo doesn't fail the test.
    this.confirmPasswordRequired = page.getByText(/^Confirm Pas{1,2}word is required$/);
    this.successMessage = page.getByText('Password changed successfully');
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

  // Clicks Reset and waits for the app's verdict. Every refusal shows an error and keeps this
  // screen open; acceptance shows the success message.
  async submitReset(): Promise<'accepted' | 'refused'> {
    await this.resetButton.click();

    const refusal = this.invalidPasswordError
      .or(this.mismatchError)
      .or(this.maxLengthError)
      .or(this.newPasswordRequired)
      .or(this.errorMessage);
    await expect(refusal.or(this.successMessage).first()).toBeVisible();

    return (await this.successMessage.isVisible()) ? 'accepted' : 'refused';
  }

  async toggleNewPasswordVisibility(): Promise<void> {
    await this.newPasswordVisibilityToggle.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.cancelConfirmationDialog.confirm();
  }

  async expectInvalidPasswordError(): Promise<void> {
    await expect(this.invalidPasswordError).toBeVisible();
  }

  // The field is flagged on blur, but the message only shows after Reset.
  async expectConfirmPasswordFlagged(): Promise<void> {
    await expect(this.confirmPasswordInput).toHaveAttribute('aria-invalid', 'true');
  }

  async expectNewPasswordMasked(): Promise<void> {
    await expect(this.newPasswordInput).toHaveAttribute('type', 'password');
  }

  async expectNewPasswordShown(): Promise<void> {
    await expect(this.newPasswordInput).toHaveAttribute('type', 'text');
  }

  async expectRequiredErrors(): Promise<void> {
    await expect(this.newPasswordRequired).toBeVisible();
    await expect(this.confirmPasswordRequired).toBeVisible();
  }

  async expectMaxLengthError(): Promise<void> {
    await expect(this.maxLengthError).toBeVisible();
  }

  async expectMismatchError(): Promise<void> {
    await expect(this.mismatchError).toBeVisible();
  }

  // The app leaves this screen only when the reset is accepted; a rejection keeps it open.
  async expectResetAccepted(): Promise<void> {
    await expect(this.heading).toBeHidden();
  }

  async expectPasswordReuseError(): Promise<void> {
    await expect(this.errorMessage).toHaveText('Your new password cannot be same as last 3 passwords');
  }
}
