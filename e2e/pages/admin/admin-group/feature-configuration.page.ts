import { expect, type Locator, type Page } from '@playwright/test';
import { MessageDialog } from '../components/message-dialog.component';
import { readSaveResult, type SaveResult } from '../components/user-form.component';

// Feature Configurations, opened from a row of Role Permissions or Admin Users: one checkbox per
// notification feature, named after it, under a line naming whose features they are.
export class FeatureConfigurationPage {
  readonly messageDialog: MessageDialog;

  private readonly page: Page;
  private readonly heading: Locator;
  private readonly checkboxes: Locator;
  private readonly submitButton: Locator;
  private readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.messageDialog = new MessageDialog(page);
    this.heading = page.getByRole('heading', { name: 'Feature Configuration', exact: true, level: 1 });
    this.checkboxes = page.locator('form input[type=checkbox]');
    this.submitButton = page.getByRole('button', { name: 'Submit', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
  }

  // owner reads like "Role : QA Admin".
  async expectDisplayed(owner: string): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.page.getByText(owner, { exact: false }).first()).toBeVisible();
  }

  async expectFeatures(names: string[]): Promise<void> {
    await expect(this.checkboxes).toHaveCount(names.length);

    for (const name of names) {
      await expect(this.page.getByRole('checkbox', { name, exact: true })).toBeVisible();
    }
  }

  async expectTicked(name: string, ticked: boolean): Promise<void> {
    await expect(this.page.getByRole('checkbox', { name, exact: true })).toBeChecked({ checked: ticked });
  }

  // A styled checkmark covers each checkbox and takes the click, which its label passes on.
  async setTicked(name: string, ticked: boolean): Promise<void> {
    await this.page.getByRole('checkbox', { name, exact: true }).setChecked(ticked, { force: true });
  }

  // Returns what the server said to the save.
  async submit(): Promise<SaveResult> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (candidate) =>
          candidate.request().method() === 'POST' &&
          /\/api\/v1\/admin-(role|user)-features$/.test(new URL(candidate.url()).pathname),
      ),
      this.submitButton.click(),
    ]);
    return readSaveResult(response);
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
