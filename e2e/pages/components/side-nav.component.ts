import { expect, type Locator, type Page } from '@playwright/test';

export class SideNav {
  private readonly nav: Locator;
  private readonly smsMenu: Locator;
  private readonly smsCampaignsSubMenu: Locator;

  constructor(page: Page) {
    this.nav = page.getByRole('navigation');
    this.smsMenu = page.locator("//div[contains(@class, 'menu-event') and .//span[contains(@class, 'icon-Menu_SMS')]]");
    this.smsCampaignsSubMenu = page
      .locator("//span[normalize-space()='Campaigns' and following::span[normalize-space()='Sender IDs']]")
      .first();
  }

  async openSmsCampaigns(): Promise<void> {
    await this.smsMenu.click();
    await this.smsCampaignsSubMenu.click();
  }

  // Expands a section and opens one of its entries. Entry names repeat across sections
  // (Campaigns, Templates), but only the expanded section's entries are visible.
  async open(section: string, entry: string): Promise<void> {
    await this.nav.getByText(section, { exact: true }).first().click();
    await this.nav.getByText(entry, { exact: true }).filter({ visible: true }).last().click();
  }

  // Waits for the last section so the list is complete before it is read.
  async sectionLabels(): Promise<string[]> {
    await expect(this.nav.getByText('Users', { exact: true })).toBeVisible();
    const labels = await this.nav.getByRole('listitem').allInnerTexts();
    return labels.map((label) => label.trim());
  }
}
