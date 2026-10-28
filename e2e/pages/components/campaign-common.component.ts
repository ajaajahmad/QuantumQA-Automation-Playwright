import type { Locator, Page } from '@playwright/test';
import { xpathLiteral } from '../../utils/xpath';

export class CampaignCommonComponent {
  private readonly campaignNameInput: Locator;
  private readonly categoryDropdown: Locator;
  private readonly categorySearchInput: Locator;

  constructor(private readonly page: Page) {
    this.campaignNameInput = page.locator("//div[contains(@class,'campaign-name')]//input[@type='text']");
    this.categoryDropdown = page.locator(
      "//label[contains(normalize-space(.),'Campaign Category')]/following-sibling::app-custom-select-with-create//div[contains(@class,'ng-select-container')]",
    );
    this.categorySearchInput = page.locator("//ng-dropdown-panel//input[@placeholder='Search ...']");
  }

  async enterCampaignName(campaignName: string): Promise<void> {
    await this.campaignNameInput.fill(campaignName);
  }

  async selectCampaignCategory(categoryText: string): Promise<void> {
    await this.categoryDropdown.click();
    await this.categorySearchInput.fill(categoryText);
    await this.page
      .locator(`//ng-dropdown-panel//div[@role='option']//span[@title=${xpathLiteral(categoryText)}]`)
      .click();
  }
}
