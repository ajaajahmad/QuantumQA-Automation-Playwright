import { expect, type Locator, type Page } from '@playwright/test';

// APP Push > Configurations > Create Integration. Configuring needs a real FCM private key, so the
// specs only read the form and try it empty, with writes blocked.
export class CreatePushIntegrationPage {
  private readonly heading: Locator;
  private readonly appName: Locator;
  private readonly serviceProvider: Locator;
  private readonly projectId: Locator;
  private readonly configureButton: Locator;
  private readonly cancelButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByText('App Push Integration', { exact: true });
    this.appName = page.locator('input[formcontrolname=appName]');
    this.serviceProvider = page.locator('ng-select').first();
    this.projectId = page.locator('input[formcontrolname=project_id]');
    this.configureButton = page.getByRole('button', { name: 'Configure', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
  }

  async expectForm(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.appName).toHaveValue('');
    await expect(this.serviceProvider).toContainText('FCM');
    await expect(this.page.getByText('iOS Certificate (FCM Private Key)')).toBeVisible();
    await expect(this.page.getByText('Android Certificate (FCM Private Key)')).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Upload File' })).toHaveCount(2);
    await expect(this.projectId).toHaveValue('');
  }

  async serviceProviders(): Promise<string[]> {
    await this.serviceProvider.click();
    const options = (await this.page.locator('ng-dropdown-panel .ng-option').allInnerTexts()).map((option) => option.trim());
    await this.page.keyboard.press('Escape');
    return options;
  }

  async configure(): Promise<void> {
    await this.configureButton.click();
  }

  // The messages under the fields the form wants filled.
  async expectFieldErrors(messages: string[]): Promise<void> {
    for (const message of messages) {
      await expect(this.page.getByText(message, { exact: true })).toBeVisible();
    }
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await expect(this.page).toHaveURL(/\/integration\/app-push\/listing$/);
  }
}
