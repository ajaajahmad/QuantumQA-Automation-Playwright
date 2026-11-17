import { expect, type Locator, type Page } from '@playwright/test';
import { appConfig } from '../../../utils/config';
import { AdminSideNav } from '../components/admin-side-nav.component';

export type NewAdminUser = {
  organization: string;
  companyName: string;
  fullName: string;
  username: string;
  email: string;
  mobile: string;
  dltEntityId: string;
  currencyUnit: string;
  amount: string;
  timeZone: string;
  country: string;
  expiresInYear: number;
};

export type SaveResult = { status: number; success: boolean; message: string };

// Users > Create User. Writes are allowed on this page only (the user's grant, 2026-11-17); the
// specs that use it run in the opt-in admin-write project. SMPP stays off.
export class CreateUserPage {
  readonly sideNav: AdminSideNav;

  private readonly page: Page;
  private readonly createUserButton: Locator;
  private readonly basicInformation: Locator;
  private readonly saveButton: Locator;
  private readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sideNav = new AdminSideNav(page);
    this.createUserButton = page.getByRole('button', { name: 'Create User', exact: true });
    this.basicInformation = page.getByRole('heading', { name: 'Basic Information', level: 2 });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
  }

  // A fresh load of the create route lands on Organizations, so it is reached through Users.
  async open(): Promise<void> {
    await this.page.goto(new URL('#/organizations/listing', appConfig.adminUrl).toString(), {
      waitUntil: 'domcontentloaded',
    });
    await this.sideNav.openEntry('Users');
    await this.createUserButton.click();
    await expect(this.page).toHaveURL(/#\/organizations\/user\/create$/);
    await expect(this.basicInformation).toBeVisible();
  }

  async enterDetails(user: NewAdminUser): Promise<void> {
    await this.pick('Organizations', user.organization);
    await this.pickFirst('Contracts');
    await this.choose('Deduction Mode', 'Currency');
    await this.pick('Currency Unit', user.currencyUnit);
    await this.page.locator('#amount').fill(user.amount);
    await this.page.locator('#company_name').fill(user.companyName);
    await this.page.locator('#full_name').fill(user.fullName);
    await this.page.locator('#username').fill(user.username);
    await this.page.locator('#email').fill(user.email);
    await this.enterMobile(user.mobile);
    await this.pickExpiryDate(user.expiresInYear);
    await this.pick('Time Zone', user.timeZone, new RegExp(`\\b${escapeRegExp(user.timeZone)}\\b`));
    await this.pick('Country', user.country);
    await this.page.locator('#dlt_entity_id').fill(user.dltEntityId);
    // Vertical is disabled on create (the app's field schema says so), so it is left as the app sets it.
    await this.pickFirst('Daily Threshold Check');
    await this.pickFirst('Sales Head');
    await this.pickFirst('Business Account Manager');
  }

  // Returns what the server said; the page itself shows nothing for some failures.
  async save(): Promise<SaveResult> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (candidate) =>
          candidate.request().method() === 'POST' && new URL(candidate.url()).pathname.endsWith('/api/v1/users'),
      ),
      this.saveButton.click(),
    ]);
    const body = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string };
    return { status: response.status(), success: body.success === true, message: body.message ?? '' };
  }

  // A save confirms in a Success dialog; closing it opens the new user's edit page, which is
  // only read here, never saved.
  async expectSavedAndOpened(user: NewAdminUser): Promise<void> {
    // The dialog nests one .modal-content in another; the inner one holds the message and button.
    const dialog = this.page.locator('#modalChild').filter({ hasText: 'User created successfully.' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();

    await expect(this.page).toHaveURL(/#\/organizations\/user\/edit\/\d+$/);
    await expect(this.page.locator('#username')).toHaveValue(user.username);
    await expect(this.page.locator('#email')).toHaveValue(user.email);
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  // The labels' for attributes hold their text instead of an input id, so fields are found by
  // the container around the label.
  private field(label: string): Locator {
    return this.page.locator(
      `xpath=//label[normalize-space()='${label}']/parent::div[contains(@class,'field-label')]/parent::*`,
    );
  }

  // Types the search text and clicks the option whose whole text matches it, unless a pattern
  // says otherwise (time zones read like "(GMT+5:30) Asia/Kolkata (India Standard Time)").
  private async pick(label: string, search: string, option?: RegExp): Promise<void> {
    const select = this.field(label).locator('ng-select').first();
    await select.click();
    await select.locator('input').fill(search);
    await this.page
      .locator('ng-dropdown-panel .ng-option')
      .filter({ hasText: option ?? new RegExp(`^\\s*${escapeRegExp(search)}\\s*$`) })
      .first()
      .click();
  }

  private async pickFirst(label: string): Promise<void> {
    await this.field(label).locator('ng-select').first().click();
    await this.page.locator('ng-dropdown-panel .ng-option').first().click();
  }

  // The radio inputs sit under a styled checkmark that takes the click, so that is what is clicked.
  private async choose(group: string, option: string): Promise<void> {
    const choice = this.field(group)
      .locator('.form-check')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(option)}\\s*$`) });
    await choice.locator('.checkmark').click();
    await expect(choice.locator('input')).toBeChecked();
  }

  // Country code first (India, +91), then the number.
  private async enterMobile(mobile: string): Promise<void> {
    const mobileField = this.field('Mobile');
    await mobileField.locator('ng-select').click();
    await mobileField.locator('ng-select input').fill('91');
    await this.page.locator('ng-dropdown-panel .ng-option').filter({ hasText: /\+91\b|India/ }).first().click();
    await mobileField.locator('.country_code input').fill(mobile);
  }

  // A read-only input that opens a calendar with month and year selects; a day click applies it.
  private async pickExpiryDate(year: number): Promise<void> {
    await this.field('Expires On').locator('input[name="dp"]').click();
    const calendar = this.page.locator('.md-drppicker.shown');
    await calendar.locator('select.yearselect').selectOption(String(year));
    await calendar.locator('td.available:not(.off)').filter({ hasText: /^15$/ }).first().click();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
