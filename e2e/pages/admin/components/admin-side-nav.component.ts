import { expect, type Locator, type Page } from '@playwright/test';

// Two columns: the groups (Admin, User Onboarding, the channels and so on), and the entries of
// the group that is open.
export class AdminSideNav {
  private readonly groups: Locator;
  private readonly activeGroup: Locator;
  private readonly entries: Locator;

  constructor(page: Page) {
    this.groups = page.locator('.sidebar-left li.nav-item');
    this.activeGroup = page.locator('.sidebar-left li.nav-item.active');
    this.entries = page.locator('.sidebar-left-secondary li.nav-item');
  }

  async expectGroups(labels: string[]): Promise<void> {
    await expect(this.groups).toHaveText(labels);
  }

  async expectActiveGroup(label: string): Promise<void> {
    await expect(this.activeGroup).toHaveText(label);
  }

  async expectEntries(labels: string[]): Promise<void> {
    await expect(this.entries).toHaveText(labels);
  }
}
