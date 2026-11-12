import { expect, type Locator, type Page } from '@playwright/test';

export type SettingsItem = 'Account Details' | 'Currency Alert' | 'Currency History' | 'Password';

// The bar above every logged-in page: currency balance, language menu and profile menu.
export class AppHeader {
  private readonly logo: Locator;
  private readonly currencyBalance: Locator;
  private readonly languageButton: Locator;
  private readonly arabicOption: Locator;
  private readonly profileButton: Locator;
  private readonly profileMenu: Locator;
  private readonly profileName: Locator;
  private readonly settingsMenu: Locator;
  private readonly logoutItem: Locator;

  constructor(page: Page) {
    this.logo = page.getByRole('navigation').getByRole('img', { name: 'Logo' });
    this.currencyBalance = page.getByText('Currency Left:').locator('xpath=following-sibling::*[1]');
    this.languageButton = page.getByRole('button', { name: 'English' });
    this.arabicOption = page.getByText('Arabic (AR)');
    this.profileButton = page.locator('.user-name-alias');
    this.profileMenu = page.locator('.user-dropdown');
    this.profileName = this.profileMenu.locator('> .dropdown-item').first();
    // Settings opens a nested menu on hover rather than navigating itself.
    this.settingsMenu = this.profileMenu.locator('.settings-menu');
    this.logoutItem = this.profileMenu.getByText('Logout', { exact: true });
  }

  async clickLogo(): Promise<void> {
    await this.logo.click();
  }

  // The app formats the balance with comma thousands separators, e.g. INR 1,234,567.
  async expectCurrencyBalance(currencyUnit: string, balance: number): Promise<void> {
    await expect(this.currencyBalance).toHaveText(`${currencyUnit} ${balance.toLocaleString('en-US')}`);
  }

  // Only opens and closes the menu: switching language would change the account's preference.
  async expectLanguageOptions(): Promise<void> {
    await this.languageButton.click();
    await expect(this.arabicOption).toBeVisible();
    await this.languageButton.click();
    await expect(this.arabicOption).toBeHidden();
  }

  async openProfileMenu(): Promise<void> {
    await this.profileButton.click();
    await expect(this.profileMenu).toBeVisible();
  }

  // The profile button shows the initials of the name at the top of the menu.
  async expectProfileMenuContents(): Promise<void> {
    const name = (await this.profileName.innerText()).trim();
    const initials = name
      .split(/\s+/)
      .map((word) => word[0])
      .join('')
      .toUpperCase();

    expect(name, 'profile menu should show the user name').not.toBe('');
    await expect(this.profileButton).toHaveText(initials);
    await expect(this.settingsMenu).toBeVisible();
    await expect(this.logoutItem).toBeVisible();
  }

  async openSettings(item: SettingsItem): Promise<void> {
    await this.openProfileMenu();
    await this.settingsMenu.hover();
    await this.settingsMenu.locator('.nested-dropdown').getByText(item, { exact: true }).click();
  }
}
