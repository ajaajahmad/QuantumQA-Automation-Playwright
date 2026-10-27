import type { Locator, Page } from '@playwright/test';
import { BasePage, xpathLiteral } from '../base.page';

export class CampaignCommonComponent extends BasePage {
  private readonly campaignNameInput: Locator;
  private readonly categoryDropdown: Locator;
  private readonly categorySearchInput: Locator;

  constructor(page: Page) {
    super(page);
    this.campaignNameInput = page.locator("//div[contains(@class,'campaign-name')]//input[@type='text']");
    this.categoryDropdown = page.locator(
      "//label[contains(normalize-space(.),'Campaign Category')]/following-sibling::app-custom-select-with-create//div[contains(@class,'ng-select-container')]",
    );
    this.categorySearchInput = page.locator("//ng-dropdown-panel//input[@placeholder='Search ...']");
  }

  async enterCampaignName(campaignName: string): Promise<void> {
    await this.type(this.campaignNameInput, campaignName);
  }

  async selectCampaignCategory(categoryText: string): Promise<void> {
    await this.click(this.categoryDropdown);
    await this.type(this.categorySearchInput, categoryText);
    await this.page
      .locator(`//ng-dropdown-panel//div[@role='option']//span[@title=${xpathLiteral(categoryText)}]`)
      .click();
  }
}
