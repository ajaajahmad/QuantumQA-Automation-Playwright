import { expect, type Locator, type Page, type Route } from '@playwright/test';
import { readSaveResult, type SaveResult, UserForm } from '../components/user-form.component';

// The fields the update spec changes. Mobile and email are left out: the Approval page queues
// email and mobile changes, so editing them could file a request there.
export type UserDetailsUpdate = {
  companyName: string;
  fullName: string;
  state: string;
  city: string;
  zipCode: string;
  address: string;
  sessionTimeout: number;
};

// A user's edit page, opened from the Users list. One of the two admin pages the specs write to
// (the user's grants, 2026-11-17), and only for the qa_auto_ users the Create User spec made.
export class EditUserPage {
  readonly form: UserForm;

  private readonly page: Page;
  private readonly updateButton: Locator;
  private readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.form = new UserForm(page);
    this.updateButton = page.getByRole('button', { name: 'Update', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
  }

  // The username can't be changed here, so it names the user the page is for.
  async expectOpened(username: string): Promise<void> {
    await expect(this.page).toHaveURL(/#\/organizations\/user\/edit\/\d+$/);
    await this.form.expectText('username', username);
  }

  async enterDetails(details: UserDetailsUpdate): Promise<void> {
    await this.form.fillText('company_name', details.companyName);
    await this.form.fillText('full_name', details.fullName);
    await this.form.openSection('Additional Information');
    await this.form.fillText('state', details.state);
    await this.form.fillText('city', details.city);
    await this.form.fillText('zipcode', details.zipCode);
    await this.form.fillText('address', details.address);
    await this.form.fillText('session_timeout', String(details.sessionTimeout));
  }

  async expectDetails(details: UserDetailsUpdate): Promise<void> {
    await this.form.expectText('company_name', details.companyName);
    await this.form.expectText('full_name', details.fullName);
    await this.form.openSection('Additional Information');
    await this.form.expectText('state', details.state);
    await this.form.expectText('city', details.city);
    await this.form.expectText('zipcode', details.zipCode);
    await this.form.expectText('address', details.address);
    await this.form.expectText('session_timeout', String(details.sessionTimeout));
  }

  // Returns what the server said to PUT users/<id>, which sends the whole form.
  async update(): Promise<SaveResult> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (candidate) =>
          candidate.request().method() === 'PUT' && /\/api\/v1\/users\/\d+$/.test(new URL(candidate.url()).pathname),
      ),
      this.updateButton.click(),
    ]);
    return readSaveResult(response);
  }

  // The id the edit route carries, which the admin API uses for the user.
  userId(): number {
    const id = /#\/organizations\/user\/edit\/(\d+)$/.exec(this.page.url())?.[1];

    if (!id) {
      throw new Error(`Not on a user's edit page: ${this.page.url()}`);
    }

    return Number(id);
  }

  // The whole form Update would send, taken from the request with the request itself stopped,
  // so nothing is saved.
  async captureUpdate(): Promise<Record<string, unknown>> {
    const isUpdate = (url: URL) => /\/api\/v1\/users\/\d+$/.test(url.pathname);
    let form: Record<string, unknown> | undefined;
    const stop = async (route: Route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      form = route.request().postDataJSON() as Record<string, unknown>;
      await route.abort();
    };

    await this.page.route(isUpdate, stop);
    await this.updateButton.click();
    await expect.poll(() => form !== undefined, { message: 'an Update request' }).toBe(true);
    await this.page.unroute(isUpdate, stop);
    await this.dismissResult();
    return form!;
  }

  // A refused or stopped save may leave a dialog over the page; this closes it if one is open.
  async dismissResult(): Promise<void> {
    const dialog = this.page.locator('#modalChild').filter({ visible: true });

    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole('button', { name: /^(Close|Cancel|Ok)$/ }).first().click();
      await expect(dialog).toBeHidden();
    }
  }

  // A saved update confirms in a Success dialog that covers the page until it is closed.
  async expectUpdated(): Promise<void> {
    const dialog = this.page.locator('#modalChild').filter({ hasText: 'Your changes have been saved successfully.' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
