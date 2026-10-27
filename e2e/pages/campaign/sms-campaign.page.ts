import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../base.page';
import { CampaignCommonComponent } from '../components/campaign-common.component';
import { TableSelectionManager } from '../../utils/table-selection-manager';

export class SmsCampaignPage extends BasePage {
  private readonly tableSelectionManager: TableSelectionManager;
  private readonly campaignCommonComponent: CampaignCommonComponent;

  private readonly smsMenu: Locator;
  private readonly campaignsSubMenu: Locator;
  private readonly campaignsDltPopup: Locator;
  private readonly createCampaign: Locator;
  private readonly campaignType: Locator;
  private readonly importContacts: Locator;
  private readonly contactsListTab: Locator;
  private readonly contactsListSearchInput: Locator;
  private readonly contactsListGoButton: Locator;
  private readonly contactsImportButton: Locator;
  private readonly chooseTemplateButton: Locator;
  private readonly searchTemplateInput: Locator;
  private readonly templateSaveButton: Locator;
  private readonly campaignSendButton: Locator;
  private readonly campaignSendNowButton: Locator;

  constructor(page: Page) {
    super(page);
    this.tableSelectionManager = new TableSelectionManager(page);
    this.campaignCommonComponent = new CampaignCommonComponent(page);

    this.smsMenu = page.locator("//div[contains(@class, 'menu-event') and .//span[contains(@class, 'icon-Menu_SMS')]]");
    this.campaignsSubMenu = page
      .locator("//span[normalize-space()='Campaigns' and following::span[normalize-space()='Sender IDs']]")
      .first();
    this.campaignsDltPopup = page.locator("//button[contains(text(),'OK')]");
    this.createCampaign = page.locator(
      "//button[@class='btn btn-design btn-send ng-star-inserted']//span[contains(text(),'Create Campaign')]",
    );
    this.campaignType = page.locator("//input[@value='Personalised']");
    this.importContacts = page.locator("//button[contains(text(),'Import Contacts')]");
    this.contactsListTab = page.locator("//span[@class='mdc-tab__text-label'][contains(text(),'Lists')]");
    this.contactsListSearchInput = page.locator("//input[@placeholder='Search List']");
    this.contactsListGoButton = page.locator("//button[contains(text(),'Go')]");
    this.contactsImportButton = page.locator(
      "//button[contains(@class,'process-file') and contains(normalize-space(),'Import')]",
    );
    this.chooseTemplateButton = page.locator("//button[contains(@class,'btn-design') and contains(text(),'Choose Template')]");
    this.searchTemplateInput = page.locator("//input[contains(@class,'filter-search')]");
    this.templateSaveButton = page.locator('button.import-btn.btn-design');
    this.campaignSendButton = page.locator('button.btn-design.btn-send');
    this.campaignSendNowButton = page.locator(
      "//button[@type='button' and contains(normalize-space(.),'Send Now')]",
    );
  }

  async clickOnSmsMenu(): Promise<void> {
    await this.click(this.smsMenu);
  }

  async clickOnCampaignsSubMenu(): Promise<void> {
    await this.click(this.campaignsSubMenu);
  }

  async acknowledgeDltPopupWindow(): Promise<void> {
    if (await this.campaignsDltPopup.isVisible().catch(() => false)) {
      await this.click(this.campaignsDltPopup);
    }
  }

  async clickOnCreateCampaignButton(): Promise<void> {
    await this.click(this.createCampaign);
  }

  async enterCampaignName(campaignName: string): Promise<void> {
    await this.campaignCommonComponent.enterCampaignName(campaignName);
  }

  async selectCampaignCategory(categoryText: string): Promise<void> {
    await this.campaignCommonComponent.selectCampaignCategory(categoryText);
  }

  async selectCampaignType(): Promise<void> {
    await this.click(this.campaignType);
  }

  async clickOnImportContacts(): Promise<void> {
    await this.click(this.importContacts);
  }

  async clickOnListTab(): Promise<void> {
    await this.click(this.contactsListTab);
  }

  async searchContactList(listName: string): Promise<void> {
    await this.type(this.contactsListSearchInput, listName);
  }

  async selectContactList(contactListName: string): Promise<void> {
    await this.tableSelectionManager.selectContactListByName(contactListName);
  }

  async clickOnGoButton(): Promise<void> {
    await this.click(this.contactsListGoButton);
  }

  async clickOnImportButton(): Promise<void> {
    await this.click(this.contactsImportButton);
  }

  async clickOnChooseTemplate(): Promise<void> {
    await this.click(this.chooseTemplateButton);
  }

  async searchTemplate(templateName: string): Promise<void> {
    await this.searchTemplateInput.fill(templateName);
    await this.searchTemplateInput.press('Enter');
  }

  async selectTemplate(templateName: string): Promise<void> {
    await this.tableSelectionManager.selectTemplateByName(templateName);
  }

  async clickOnSaveButton(): Promise<void> {
    await this.click(this.templateSaveButton);
  }

  async clickOnSendButton(): Promise<void> {
    await this.click(this.campaignSendButton);
  }

  async clickOnSendNowButton(): Promise<void> {
    await this.click(this.campaignSendNowButton);
    await expect(this.campaignSendNowButton).toBeHidden();
  }
}
