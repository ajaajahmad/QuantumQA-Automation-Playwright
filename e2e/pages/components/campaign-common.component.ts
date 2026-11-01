import { expect, type Locator, type Page } from '@playwright/test';
import { xpathLiteral } from '../../utils/xpath';

export class CampaignCommonComponent {
  private readonly campaignNameInput: Locator;
  private readonly categoryDropdown: Locator;
  private readonly categorySelectedValue: Locator;
  private readonly categorySearchInput: Locator;
  private readonly categoryNoRecords: Locator;
  private readonly categoryCreateNewInput: Locator;
  private readonly categoryCreateNewButton: Locator;

  constructor(private readonly page: Page) {
    this.campaignNameInput = page.locator("//div[contains(@class,'campaign-name')]//input[@type='text']");
    this.categoryDropdown = page.locator(
      "//label[contains(normalize-space(.),'Campaign Category')]/following-sibling::app-custom-select-with-create//div[contains(@class,'ng-select-container')]",
    );
    this.categorySelectedValue = this.categoryDropdown.locator('.ng-value');
    this.categorySearchInput = page.locator("//ng-dropdown-panel//input[@placeholder='Search ...']");
    this.categoryNoRecords = page.locator('ng-dropdown-panel').getByText('No Records');
    this.categoryCreateNewInput = page.locator('.custom-select-with-create-create-new input[placeholder="Create New"]');
    this.categoryCreateNewButton = page.locator('button.custom-select-with-create-create-new-submit');
  }

  async enterCampaignName(campaignName: string): Promise<void> {
    await this.campaignNameInput.fill(campaignName);
  }

  // Selects the category, creating it first when the account doesn't have it yet.
  // Returns true when it had to create it.
  async selectOrCreateCampaignCategory(categoryText: string): Promise<boolean> {
    const option = this.page.locator(
      `//ng-dropdown-panel//div[@role='option']//span[@title=${xpathLiteral(categoryText)}]`,
    );

    await this.categoryDropdown.click();
    await this.categorySearchInput.fill(categoryText);
    await expect(option.or(this.categoryNoRecords)).toBeVisible();

    const created = !(await option.isVisible());

    if (created) {
      await this.categoryCreateNewInput.fill(categoryText);
      await this.categoryCreateNewButton.click();
      await expect(option.or(this.categorySelectedValue)).toBeVisible();
    }

    if (await option.isVisible()) {
      await option.click();
    }

    await expect(this.categorySelectedValue).toHaveText(categoryText);
    return created;
  }
}
