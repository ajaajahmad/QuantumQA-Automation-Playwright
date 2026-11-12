import { expect, type Locator, type Page } from '@playwright/test';

// Only the parts the regression tests touch: the dropdown options, an empty Save and Cancel.
// Nothing here creates a template.
export class CreateTemplatePage {
  private readonly heading: Locator;
  private readonly senderIdDropdown: Locator;
  private readonly contentTypeDropdown: Locator;
  private readonly dropdownOptions: Locator;
  private readonly saveButton: Locator;
  private readonly cancelButton: Locator;
  private readonly formError: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Create Template', exact: true });
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
