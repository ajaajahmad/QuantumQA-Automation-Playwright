import { expect, type Locator, type Page } from '@playwright/test';
import { appConfig } from '../../../utils/config';
import { AdminSideNav } from '../components/admin-side-nav.component';
import { readSaveResult, type SaveResult, UserForm } from '../components/user-form.component';

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

// Users > Create User. Writes are allowed on this page only (the user's grant, 2026-11-17); the
// specs that use it run in the opt-in admin-write project. SMPP stays off.
export class CreateUserPage {
  readonly sideNav: AdminSideNav;
  readonly form: UserForm;

  private readonly page: Page;
  private readonly createUserButton: Locator;
  private readonly basicInformation: Locator;
  private readonly saveButton: Locator;
  private readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sideNav = new AdminSideNav(page);
    this.form = new UserForm(page);
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
    await this.form.pick('Organizations', user.organization);
    await this.form.pickFirst('Contracts');
    await this.form.choose('Deduction Mode', 'Currency');
    await this.form.pick('Currency Unit', user.currencyUnit);
    await this.form.fillText('amount', user.amount);
    await this.form.fillText('company_name', user.companyName);
    await this.form.fillText('full_name', user.fullName);
    await this.form.fillText('username', user.username);
    await this.form.fillText('email', user.email);
    await this.form.enterMobile(user.mobile);
    await this.form.pickExpiryDate(user.expiresInYear);
    await this.form.pick('Time Zone', user.timeZone, new RegExp(`\\b${escapeRegExp(user.timeZone)}\\b`));
    await this.form.pick('Country', user.country);
    await this.form.fillText('dlt_entity_id', user.dltEntityId);
    // Vertical is disabled on create (the app's field schema says so), so it is left as the app sets it.
    await this.form.pickFirst('Daily Threshold Check');
    await this.form.pickFirst('Sales Head');
    await this.form.pickFirst('Business Account Manager');
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
    return readSaveResult(response);
  }

  // A save confirms in a Success dialog; closing it opens the new user's edit page, which is
  // only read here, never saved.
  async expectSavedAndOpened(user: NewAdminUser): Promise<void> {
    // The dialog nests one .modal-content in another; the inner one holds the message and button.
    const dialog = this.page.locator('#modalChild').filter({ hasText: 'User created successfully.' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();

    await expect(this.page).toHaveURL(/#\/organizations\/user\/edit\/\d+$/);
    await this.form.expectText('username', user.username);
    await this.form.expectText('email', user.email);
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
