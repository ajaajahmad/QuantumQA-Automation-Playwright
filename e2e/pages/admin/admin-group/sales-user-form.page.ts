import { expect, type Locator, type Page } from '@playwright/test';
import { MessageDialog } from '../components/message-dialog.component';
import { readSaveResult, type SaveResult, UserForm } from '../components/user-form.component';

export type SalesUserDetails = {
  fullName: string;
  email: string;
  mobile: string;
  country: string;
  expiresOn: Date;
  team: string;
  salesHead: boolean;
  businessAccountManager: boolean;
  technicalAccountManager: boolean;
  status: 'Active' | 'Inactive';
  adminUser: boolean;
};

// The three roles a sales user can hold; each one makes the user an option in that picker of the
// user form (Sales Head, Business Account Manager, Technical Account Manager).
const roleLabels = {
  salesHead: 'Sales Head',
  businessAccountManager: 'Business Account Manager',
  technicalAccountManager: 'Technical Account Manager',
} as const;

// Sales Users > Create Sales User, and a sales user's edit page, which opens the same form with
// Email read-only and Update in place of Save.
export class SalesUserFormPage {
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
    this.heading = page.getByRole('heading', { name: 'Sales User', exact: true, level: 1 });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.updateButton = page.getByRole('button', { name: 'Update', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
  }

  async expectCreateForm(): Promise<void> {
    await expect(this.page).toHaveURL(/#\/sales-user\/listing\/create-sales-user$/);
    await expect(this.heading).toBeVisible();
    await expect(this.saveButton).toBeVisible();
  }

  async expectEditForm(id: number): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`#/sales-user/listing/edit/${id}$`));
    await expect(this.heading).toBeVisible();
    await expect(this.updateButton).toBeVisible();
  }

  // Fills the given fields only, so a test can leave some as the form set them.
  async enter(details: Partial<SalesUserDetails>): Promise<void> {
    if (details.fullName !== undefined) await this.form.fillText('full_name', details.fullName);
    if (details.email !== undefined) await this.form.fillText('email', details.email);
    if (details.mobile !== undefined) await this.form.enterMobile(details.mobile);
    if (details.country !== undefined) await this.form.pick('Country', details.country);
    if (details.expiresOn !== undefined) await this.form.pickDate(details.expiresOn);
    if (details.team !== undefined) await this.form.fillText('team', details.team);

    for (const [key, label] of Object.entries(roleLabels) as [keyof typeof roleLabels, string][]) {
      if (details[key] !== undefined) await this.form.setTicked(label, details[key]);
    }

    if (details.status !== undefined) await this.form.choose('Status', details.status);
    if (details.adminUser !== undefined) await this.form.setTicked('Admin User', details.adminUser);
  }

  async expectValues(details: SalesUserDetails): Promise<void> {
    await this.form.expectText('full_name', details.fullName);
    await this.form.expectText('email', details.email);
    await this.form.expectMobile('+91', details.mobile);
    await this.form.expectPicked('Country', [details.country]);
    await this.form.expectDate(details.expiresOn);
    await this.form.expectText('team', details.team);

    for (const [key, label] of Object.entries(roleLabels) as [keyof typeof roleLabels, string][]) {
      await this.form.expectTicked(label, details[key]);
    }

    await this.form.expectChosen('Status', details.status);
    await this.form.expectTicked('Admin User', details.adminUser);
  }

  // Returns what the server said to POST sales-users.
  async save(): Promise<SaveResult> {
    return this.submit(this.saveButton, 'POST', /\/api\/v1\/sales-users$/);
  }

  // Returns what the server said to PUT sales-users/<id>.
  async update(): Promise<SaveResult> {
    return this.submit(this.updateButton, 'PUT', /\/api\/v1\/sales-users\/\d+$/);
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
