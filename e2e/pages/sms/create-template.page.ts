import { expect, type Locator, type Page } from '@playwright/test';

export type TemplateDetails = {
  name: string;
  dltTemplateId: string;
  senderId: string;
  contentType: 'Transactional' | 'Promotional' | 'Service Implicit' | 'Service Explicit';
  content: string;
};

// What the save request answered. The page itself shows no message after a save, whether the
// template was saved or refused, so the response is the only feedback.
export type TemplateSaveResult = {
  success: boolean;
  message: string;
};

// Also used to edit a template: the app opens the same form, heading included.
export class CreateTemplatePage {
  private readonly heading: Locator;
  private readonly nameInput: Locator;
  private readonly dltTemplateIdInput: Locator;
  private readonly contentInput: Locator;
  private readonly senderIdDropdown: Locator;
  private readonly contentTypeDropdown: Locator;
  private readonly dropdownOptions: Locator;
  private readonly saveButton: Locator;
  private readonly cancelButton: Locator;
  private readonly formError: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Create Template', exact: true });
    this.nameInput = page.locator("input[formcontrolname='name']");
    this.dltTemplateIdInput = page.locator("input[formcontrolname='dlt_template_id']");
    this.contentInput = page.locator("textarea[formcontrolname='content']");
    this.senderIdDropdown = this.dropdownAfterLabel('Sender ID');
    this.contentTypeDropdown = this.dropdownAfterLabel('Content Type');
    this.dropdownOptions = page.locator('ng-dropdown-panel [role="option"]');
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.formError = page.locator('[matsnackbarlabel]');
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  // The dropdown sorts sender IDs, so compare them as a set.
  async expectSenderIdOptions(senderIds: string[]): Promise<void> {
    await this.senderIdDropdown.click();
    await expect(this.dropdownOptions.first()).toBeVisible();
    const shown = (await this.dropdownOptions.allInnerTexts()).map((option) => option.trim());
    expect(shown.sort()).toEqual([...senderIds].sort());
    await this.closeDropdown();
  }

  // The dropdown also starts with a "Select" placeholder option, which isn't a content type.
  async expectContentTypeOptions(contentTypes: string[]): Promise<void> {
    await this.expectOptions(this.contentTypeDropdown, ['Select', ...contentTypes]);
  }

  async enterDetails(details: TemplateDetails): Promise<void> {
    await this.nameInput.fill(details.name);
    await this.dltTemplateIdInput.fill(details.dltTemplateId);
    await this.selectOption(this.senderIdDropdown, details.senderId);
    await this.selectOption(this.contentTypeDropdown, details.contentType);
    await this.enterContent(details.content);
  }

  async enterContent(content: string): Promise<void> {
    await this.contentInput.fill(content);
  }

  async expectName(name: string): Promise<void> {
    await expect(this.nameInput).toHaveValue(name);
  }

  async saveTemplate(): Promise<TemplateSaveResult> {
    const response = this.page.waitForResponse(
      (candidate) =>
        new URL(candidate.url()).pathname.startsWith('/api/v1/sms-templates') &&
        ['POST', 'PUT'].includes(candidate.request().method()),
    );
    await this.saveButton.click();

    const body = await (await response).json();
    return { success: body.success === true, message: String(body.message ?? '').trim() };
  }

  async clickSave(): Promise<void> {
    await this.saveButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  async expectRequiredFieldErrors(): Promise<void> {
    for (const message of [
      'Please enter Template Name.',
      'DLT Template ID required',
      'Sender Id is required',
      'Content type is required',
      'Please enter SMS Content',
    ]) {
      await expect(this.page.getByText(message, { exact: true })).toBeVisible();
    }
    await expect(this.formError).toHaveText('Please validate the form');
  }

  // The Sender ID dropdown allows several senders and stays open after a pick, so close it.
  private async selectOption(dropdown: Locator, option: string): Promise<void> {
    await dropdown.click();
    await this.dropdownOptions.filter({ hasText: new RegExp(`^\\s*${option}\\s*$`) }).click();
    if (await this.dropdownOptions.first().isVisible()) {
      await this.closeDropdown();
    }
  }

  private dropdownAfterLabel(label: string): Locator {
    return this.page.locator(`//label[normalize-space()='${label}']/following::ng-select[1]`);
  }

  private async expectOptions(dropdown: Locator, options: string[]): Promise<void> {
    await dropdown.click();
    await expect(this.dropdownOptions).toHaveText(options);
    await this.closeDropdown();
  }

  private async closeDropdown(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.dropdownOptions).toHaveCount(0);
  }
}
