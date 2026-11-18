import { expect, type Locator, type Page } from '@playwright/test';
import { MessageDialog } from '../components/message-dialog.component';
import { readSaveResult, type SaveResult, UserForm } from '../components/user-form.component';

export type AdminUserDetails = {
  fullName: string;
  // The login, an email address; the form copies it into Email, which is read-only.
  username: string;
  password: string;
  mobile: string;
  countries: string[];
  state: string;
  city: string;
  zipcode: string;
  address: string;
  role: string;
  expiresOn: Date;
  status: 'Active' | 'Inactive';
};

// Admin Users > Create Admin User, and a user's edit page, which opens the same form with
// Username and Email read-only and Update in place of Save.
export class AdminUserFormPage {
  readonly form: UserForm;
  readonly messageDialog: MessageDialog;

  private readonly page: Page;
  private readonly heading: Locator;
  private readonly saveButton: Locator;
  private readonly updateButton: Locator;
  private readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.form = new UserForm(page);
    this.messageDialog = new MessageDialog(page);
    this.heading = page.getByRole('heading', { name: 'User', exact: true, level: 1 });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.updateButton = page.getByRole('button', { name: 'Update', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
  }

  async expectCreateForm(): Promise<void> {
    await expect(this.page).toHaveURL(/#\/admin\/admin-users\/create-admin-user$/);
    await expect(this.heading).toBeVisible();
    await expect(this.saveButton).toBeVisible();
  }

  async expectEditForm(id: number): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`#/admin/admin-users/edit/${id}$`));
    await expect(this.heading).toBeVisible();
    await expect(this.updateButton).toBeVisible();
  }

  // Fills the given fields only, so a test can leave some as the form set them.
  async enter(details: Partial<AdminUserDetails>): Promise<void> {
    if (details.fullName !== undefined) await this.form.fillText('full_name', details.fullName);
    // Typed, not filled: Email copies User Name only on key and blur events.
    if (details.username !== undefined) await this.form.typeText('username', details.username);
    if (details.password !== undefined) await this.form.fillText('password', details.password);
    if (details.mobile !== undefined) await this.form.enterMobile(details.mobile);

    for (const country of details.countries ?? []) {
      await this.form.pick('Countries', country);
    }

    if (details.state !== undefined) await this.form.fillText('state', details.state);
    if (details.city !== undefined) await this.form.fillText('city', details.city);
    if (details.zipcode !== undefined) await this.form.fillText('zipcode', details.zipcode);
    if (details.expiresOn !== undefined) await this.form.pickDate(details.expiresOn);
    if (details.role !== undefined) await this.form.pick('Role', details.role);
    if (details.address !== undefined) await this.form.fillText('address', details.address);
    if (details.status !== undefined) await this.form.choose('Status', details.status);
  }

  // Every field but the password, which the form never shows again.
  async expectValues(details: Omit<AdminUserDetails, 'password'>): Promise<void> {
    await this.form.expectText('full_name', details.fullName);
    await this.form.expectText('username', details.username);
    await this.form.expectText('email', details.username);
    await this.form.expectMobile('+91', details.mobile);
    await this.form.expectPicked('Countries', details.countries);
    await this.form.expectText('state', details.state);
    await this.form.expectText('city', details.city);
    await this.form.expectText('zipcode', details.zipcode);
    await this.form.expectDate(details.expiresOn);
    await this.form.expectPicked('Role', [details.role]);
    await this.form.expectText('address', details.address);
    await this.form.expectChosen('Status', details.status);
  }

  // Returns what the server said to POST auth/register.
  async save(): Promise<SaveResult> {
    return this.submit(this.saveButton, 'POST', /\/api\/v1\/auth\/register$/);
  }

  // Returns what the server said to PUT auth/update-user/<id>.
  async update(): Promise<SaveResult> {
    return this.submit(this.updateButton, 'PUT', /\/api\/v1\/auth\/update-user\/\d+$/);
  }

  // A click on Save without waiting for an answer, for when the request is blocked.
  async clickSave(): Promise<void> {
    await this.saveButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  private async submit(button: Locator, method: string, path: RegExp): Promise<SaveResult> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (candidate) => candidate.request().method() === method && path.test(new URL(candidate.url()).pathname),
      ),
      button.click(),
    ]);
    return readSaveResult(response);
  }
}
