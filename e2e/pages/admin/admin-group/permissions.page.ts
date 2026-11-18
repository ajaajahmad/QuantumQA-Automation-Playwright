import { expect, type Locator, type Page } from '@playwright/test';
import { MessageDialog } from '../components/message-dialog.component';
import { readSaveResult, type SaveResult } from '../components/user-form.component';

export type PermissionOwner = 'role' | 'user';

const headings: Record<PermissionOwner, string> = {
  role: 'Role Management > Manage Role Permission',
  user: 'Manage User Permission',
};

// Manage Role Permissions, opened from a row of Role Permissions or of Admin Users (where it sets
// the user's own permissions). Each permission is a checkbox whose value is its permission id,
// grouped by module. A role's page heads each group with a checkbox that ticks the group, and the
// top with one that ticks everything; a user's page names the groups in plain labels instead.
export class PermissionsPage {
  readonly messageDialog: MessageDialog;

  private readonly page: Page;
  private readonly permissionBoxes: Locator;
  private readonly groupNames: Locator;
  private readonly submitButton: Locator;
  private readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.messageDialog = new MessageDialog(page);
    this.permissionBoxes = page.locator('app-checkbox input[type=checkbox][value]');
    this.groupNames = page
      .locator('app-form-builder:has(app-checkbox)')
      .locator('span.label-name, .field-label label.form-control-label');
    this.submitButton = page.getByRole('button', { name: 'Submit', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
  }

  async expectDisplayed(owner: PermissionOwner): Promise<void> {
    await expect(this.page.getByRole('heading', { name: headings[owner], exact: true, level: 1 })).toBeVisible();
  }

  // The module groups, in the order the permissions API returns them.
  async expectGroups(groups: string[]): Promise<void> {
    await expect(this.groupNames).toHaveText(groups);
  }

  async expectPermissionIds(ids: number[]): Promise<void> {
    await expect.poll(() => this.values(this.permissionBoxes)).toEqual(sorted(ids));
  }

  // The ticks load after the page, so this waits for them to match.
  async expectTicked(ids: number[]): Promise<void> {
    await expect.poll(() => this.values(this.page.locator('app-checkbox input[type=checkbox][value]:checked'))).toEqual(sorted(ids));
  }

  // A styled checkmark covers each checkbox and takes the click, which its label passes on.
  async setTicked(id: number, ticked: boolean): Promise<void> {
    await this.page.locator(`app-checkbox input[type=checkbox][value="${id}"]`).setChecked(ticked, { force: true });
  }

  // Returns what the server said to the save.
  async submit(): Promise<SaveResult> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (candidate) =>
          candidate.request().method() === 'POST' && /\/api\/v1\/(role|user)-permissions$/.test(new URL(candidate.url()).pathname),
      ),
      this.submitButton.click(),
    ]);
    return readSaveResult(response);
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  private async values(boxes: Locator): Promise<number[]> {
    return sorted(await boxes.evaluateAll((elements) => elements.map((element) => Number((element as HTMLInputElement).value))));
  }
}

function sorted(ids: number[]): number[] {
  return [...new Set(ids)].sort((a, b) => a - b);
}
