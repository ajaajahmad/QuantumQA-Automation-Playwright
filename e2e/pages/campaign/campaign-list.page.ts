import { expect, type Locator, type Page } from '@playwright/test';
import { ListingComponent, type ListResponse } from '../components/listing.component';

export type CampaignRow = {
  name: string;
};

export class CampaignListPage {
  readonly listing: ListingComponent;

  private readonly heading: Locator;
  private readonly dltPopupOkButton: Locator;
  private readonly createCampaignButton: Locator;

  constructor(page: Page) {
    this.listing = new ListingComponent(page, '/api/v1/sms-campaigns');

    this.heading = page.getByRole('heading', { name: 'SMS Campaigns', exact: true });
    this.dltPopupOkButton = page.locator("//button[contains(text(),'OK')]");
    this.createCampaignButton = page.locator(
      "//button[@class='btn btn-design btn-send ng-star-inserted']//span[contains(text(),'Create Campaign')]",
    );
  }

  async open(): Promise<ListResponse<CampaignRow>> {
    const campaigns = await this.listing.open<CampaignRow>('/campaigns/sms');
    await expect(this.heading).toBeVisible();
    await this.acknowledgeDltPopupWindow();
    return campaigns;
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
