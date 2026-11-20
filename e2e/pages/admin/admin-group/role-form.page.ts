import { expect, type Locator, type Page } from '@playwright/test';
import { MessageDialog } from '../components/message.dialog';
import { readSaveResult, type SaveResult, UserForm } from '../components/user-form.component';

// Role Permissions > Create Role, and a role's edit page: one Role Name field.
export class RoleFormPage {
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
    this.heading = page.getByRole('heading', { name: 'Role Permissions', exact: true, level: 1 });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.updateButton = page.getByRole('button', { name: 'Update', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
  }

  async expectCreateForm(): Promise<void> {
    await expect(this.page).toHaveURL(/#\/roles\/role-listing\/create-role$/);
    await expect(this.heading).toBeVisible();
    await expect(this.saveButton).toBeVisible();
    await this.form.expectText('role', '');
  }

  async expectEditForm(id: number, name: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`#/roles/role-listing/edit/${id}$`));
    await expect(this.updateButton).toBeVisible();
    await this.form.expectText('role', name);
  }

  async enterName(name: string): Promise<void> {
    await this.form.fillText('role', name);
  }

  // Returns what the server said to POST roles.
  async save(): Promise<SaveResult> {
    return this.submit(this.saveButton, 'POST', /\/api\/v1\/roles$/);
  }

  // Returns what the server said to PUT roles/<id>.
  async update(): Promise<SaveResult> {
    return this.submit(this.updateButton, 'PUT', /\/api\/v1\/roles\/\d+$/);
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
