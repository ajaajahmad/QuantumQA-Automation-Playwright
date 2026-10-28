import { expect, type Locator, type Page } from '@playwright/test';
import { CampaignCommonComponent } from '../components/campaign-common.component';
import { ChooseTemplateDialog } from './choose-template.dialog';
import { ImportContactsDialog } from './import-contacts.dialog';

export type SmsCampaignDetails = {
  name: string;
  category: string;
  listName: string;
  templateName: string;
};

export class CreateSmsCampaignPage {
  readonly campaignDetails: CampaignCommonComponent;
  readonly importContactsDialog: ImportContactsDialog;
  readonly chooseTemplateDialog: ChooseTemplateDialog;

  private readonly personalisedTypeOption: Locator;
  private readonly importContactsButton: Locator;
  private readonly chooseTemplateButton: Locator;
  private readonly sendButton: Locator;
  private readonly sendNowButton: Locator;

  constructor(page: Page) {
    this.campaignDetails = new CampaignCommonComponent(page);
    this.importContactsDialog = new ImportContactsDialog(page);
    this.chooseTemplateDialog = new ChooseTemplateDialog(page);

    this.personalisedTypeOption = page.locator("//input[@value='Personalised']");
    this.importContactsButton = page.locator("//button[contains(text(),'Import Contacts')]");
    this.chooseTemplateButton = page.locator("//button[contains(@class,'btn-design') and contains(text(),'Choose Template')]");
    this.sendButton = page.locator('button.btn-design.btn-send');
    this.sendNowButton = page.locator("//button[@type='button' and contains(normalize-space(.),'Send Now')]");
  }

  async createAndSend(details: SmsCampaignDetails): Promise<void> {
    await this.campaignDetails.enterCampaignName(details.name);
    await this.campaignDetails.selectCampaignCategory(details.category);
    await this.selectPersonalisedType();

    await this.clickOnImportContacts();
    await this.importContactsDialog.importList(details.listName);

    await this.clickOnChooseTemplate();
    await this.chooseTemplateDialog.chooseTemplate(details.templateName);

    await this.sendNow();
  }

  async selectPersonalisedType(): Promise<void> {
    await this.personalisedTypeOption.click();
  }

  async clickOnImportContacts(): Promise<void> {
    await this.importContactsButton.click();
  }

  async clickOnChooseTemplate(): Promise<void> {
    await this.chooseTemplateButton.click();
  }

  async sendNow(): Promise<void> {
    await this.sendButton.click();
    await this.sendNowButton.click();
    await expect(this.sendNowButton).toBeHidden();
  }
}
