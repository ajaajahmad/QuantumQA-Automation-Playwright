import { expect, type Locator, type Page } from '@playwright/test';
import { xpathLiteral } from '../../utils/xpath';
import { CampaignCommonComponent } from '../components/campaign-common.component';
import { ChooseTemplateDialog } from './choose-template.dialog';
import { ImportContactsDialog } from './import-contacts.dialog';

export type SmsCampaignDetails = {
  name: string;
  category: string;
  // Optional: without it the form keeps the sender ID it selects by default.
  senderId?: string;
  listName: string;
  templateName: string;
};

export class CreateSmsCampaignPage {
  readonly campaignDetails: CampaignCommonComponent;
  readonly importContactsDialog: ImportContactsDialog;
  readonly chooseTemplateDialog: ChooseTemplateDialog;

  private readonly senderIdDropdown: Locator;
  private readonly senderIdSelectedValue: Locator;
  private readonly heading: Locator;
  private readonly commonTypeOption: Locator;
  private readonly personalisedTypeOption: Locator;
  private readonly importContactsButton: Locator;
  private readonly chooseTemplateButton: Locator;
  private readonly sendButton: Locator;
  private readonly sendNowButton: Locator;
  private readonly formError: Locator;

  constructor(private readonly page: Page) {
    this.campaignDetails = new CampaignCommonComponent(page);
    this.importContactsDialog = new ImportContactsDialog(page);
    this.chooseTemplateDialog = new ChooseTemplateDialog(page);

    this.senderIdDropdown = page.locator(
      "//label[normalize-space(.)='Sender ID']/following-sibling::app-custom-select-with-create//div[contains(@class,'ng-select-container')]",
    );
    this.senderIdSelectedValue = this.senderIdDropdown.locator('.ng-value');
    this.heading = page.getByRole('heading', { name: 'Create SMS Campaign', exact: true });
    this.commonTypeOption = page.locator("//input[@value='Common']");
    this.personalisedTypeOption = page.locator("//input[@value='Personalised']");
    this.importContactsButton = page.locator("//button[contains(text(),'Import Contacts')]");
    this.chooseTemplateButton = page.locator("//button[contains(@class,'btn-design') and contains(text(),'Choose Template')]");
    this.sendButton = page.locator('button.btn-design.btn-send');
    this.sendNowButton = page.locator("//button[@type='button' and contains(normalize-space(.),'Send Now')]");
    this.formError = page.locator('[matsnackbarlabel]');
  }

  // Returns whether the campaign category had to be created.
  async fillCampaignDetails(details: Pick<SmsCampaignDetails, 'name' | 'category' | 'senderId'>): Promise<boolean> {
    await this.campaignDetails.enterCampaignName(details.name);
    const categoryCreated = await this.campaignDetails.selectOrCreateCampaignCategory(details.category);

    if (details.senderId) {
      await this.selectSenderId(details.senderId);
    }

    return categoryCreated;
  }

  // The template list only shows templates registered under the selected sender ID.
  async selectSenderId(senderId: string): Promise<void> {
    await this.senderIdDropdown.click();
    await this.page
      .locator(`//ng-dropdown-panel//div[@role='option']//span[@title=${xpathLiteral(senderId)}]`)
      .click();
    await expect(this.senderIdSelectedValue).toHaveText(senderId);
  }

  async addContactsAndSend(details: Pick<SmsCampaignDetails, 'listName' | 'templateName'>): Promise<void> {
    await this.selectPersonalisedType();

    await this.clickOnImportContacts();
    await this.importContactsDialog.importList(details.listName);

    await this.clickOnChooseTemplate();
    await this.chooseTemplateDialog.chooseTemplate(details.templateName);

    await this.sendNow();
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async selectCommonType(): Promise<void> {
    await this.commonTypeOption.click();
  }

  // Contacts can only be imported once a campaign type is chosen.
  async expectImportContactsEnabled(enabled: boolean): Promise<void> {
    await expect(this.importContactsButton).toBeEnabled({ enabled });
  }

  // Clicks Send without filling the form; the app should refuse before asking to confirm.
  async clickSendExpectingValidation(): Promise<void> {
    await this.sendButton.click();
    await expect(this.formError).toHaveText('Please validate the form');
    await expect(this.sendNowButton).toBeHidden();
  }

  async expectRequiredFieldErrors(): Promise<void> {
    for (const message of ['Please select category', 'Please import contacts.', 'Please enter your message.']) {
      await expect(this.page.getByText(message, { exact: true })).toBeVisible();
    }
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

  // Waits for the send request itself: the dialog closes before the server answers.
  async sendNow(): Promise<void> {
    await this.sendButton.click();

    const sendResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' && new URL(response.url()).pathname === '/api/v1/sms-campaigns',
    );
    await this.sendNowButton.click();

    expect((await sendResponse).ok(), 'the send request should succeed').toBe(true);
    await expect(this.sendNowButton).toBeHidden();
  }
}
