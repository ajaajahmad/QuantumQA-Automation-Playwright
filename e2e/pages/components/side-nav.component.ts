import type { Locator, Page } from '@playwright/test';

export class SideNav {
  private readonly smsMenu: Locator;
  private readonly smsCampaignsSubMenu: Locator;

  constructor(page: Page) {
    this.smsMenu = page.locator("//div[contains(@class, 'menu-event') and .//span[contains(@class, 'icon-Menu_SMS')]]");
    this.smsCampaignsSubMenu = page
      .locator("//span[normalize-space()='Campaigns' and following::span[normalize-space()='Sender IDs']]")
      .first();
  }

  async openSmsCampaigns(): Promise<void> {
    await this.smsMenu.click();
    await this.smsCampaignsSubMenu.click();
  }
}
