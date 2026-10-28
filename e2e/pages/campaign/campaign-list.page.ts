import { expect, type Locator, type Page } from '@playwright/test';

export class CampaignListPage {
  private readonly dltPopupOkButton: Locator;
  private readonly createCampaignButton: Locator;

  constructor(page: Page) {
    this.dltPopupOkButton = page.locator("//button[contains(text(),'OK')]");
    this.createCampaignButton = page.locator(
      "//button[@class='btn btn-design btn-send ng-star-inserted']//span[contains(text(),'Create Campaign')]",
    );
  }

  // The DLT popup only appears for some accounts, and renders after the page loads,
  // so give it a short window to show up instead of checking visibility once.
  async acknowledgeDltPopupWindow(): Promise<void> {
    const appeared = await this.dltPopupOkButton.waitFor({ state: 'visible', timeout: 5_000 }).then(
      () => true,
      () => false,
    );

    if (appeared) {
      await this.dltPopupOkButton.click();
      await expect(this.dltPopupOkButton).toBeHidden();
    }
  }

  async clickOnCreateCampaignButton(): Promise<void> {
    await this.createCampaignButton.click();
  }
}
