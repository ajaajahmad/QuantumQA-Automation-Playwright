import { expect, type Locator, type Page, type Request } from '@playwright/test';
import { appConfig } from '../../utils/config';
import { PushCampaignSummaryDialog } from './push-campaign-summary.dialog';
import { PushImportContactsDialog } from './push-import-contacts.dialog';

export type PushContent = {
  title: string;
  // Typed into the body; personalisation is added with personalise().
  body?: string;
  imageUrl?: string;
};

// What the server counted when Send was clicked, before the summary opens.
export type PushValidation = {
  totalCount: number;
  validCount: number;
  duplicateCount: number;
  excludedCount: number;
  currencyCount: number;
  currencyUnit: string;
};

// What the server said to Test Now.
export type PushTestResult = { success: boolean; message: string };

// APP Push > Campaigns > Create Campaign. The button saves a draft at once (hidden from the
// list) and opens /campaigns/app-push/create/<id>. Five steps: Set Parameters, Upload Contacts,
// Create Content, Test Campaign and Send or Schedule. Create Content stays locked until contacts
// are imported and an app is chosen, and a reload forgets an import made before it.
export class CreatePushCampaignPage {
  readonly importDialog: PushImportContactsDialog;
  readonly summary: PushCampaignSummaryDialog;

  private readonly heading: Locator;
  private readonly campaignName: Locator;
  private readonly category: Locator;
  private readonly appName: Locator;
  private readonly importContactsButton: Locator;
  private readonly contactCount: Locator;
  private readonly removeDuplicates: Locator;
  private readonly title: Locator;
  private readonly imageUrl: Locator;
  private readonly editor: Locator;
  private readonly charCount: Locator;
  private readonly preview: Locator;
  private readonly testTokens: Locator;
  private readonly testNowButton: Locator;
  private readonly scheduleSwitch: Locator;
  private readonly scheduleInput: Locator;
  private readonly calendar: Locator;
  private readonly timezone: Locator;
  private readonly snackbar: Locator;
  private readonly options: Locator;

  constructor(private readonly page: Page) {
    this.importDialog = new PushImportContactsDialog(page);
    this.summary = new PushCampaignSummaryDialog(page);

    const parameters = page.locator('form').filter({ has: page.locator('input[formcontrolname=campaignName]') });
    this.heading = page.getByText('Create App Push Campaign', { exact: true });
    this.campaignName = page.locator('input[formcontrolname=campaignName]');
    this.category = parameters.locator('ng-select').nth(0);
    this.appName = parameters.locator('ng-select').nth(1);
    this.importContactsButton = page.getByRole('button', { name: 'Import Contacts', exact: true });
    this.contactCount = page.locator('.send-to-contacts-box span.contacts');
    this.removeDuplicates = page.locator('mat-checkbox[formcontrolname=removeDuplicate] input');
    this.title = page.locator('#title');
    this.imageUrl = page.locator('input[formcontrolname=uploadFromUrl]');
    this.editor = page.locator('#editor');
    this.charCount = page.locator('.char-counts');
    this.preview = page.locator('.preview-text-box');
    this.testTokens = page.locator('textarea[formcontrolname=typedContacts]');
    this.testNowButton = page.getByRole('button', { name: 'Test Now', exact: true });
    this.scheduleSwitch = page.locator('.schedule-switch');
    this.scheduleInput = page.locator('input[placeholder="Choose Date and Time"]').first();
    this.calendar = page.locator('.p-datepicker-panel');
    this.timezone = page.locator('app-send-message ng-select');
    this.snackbar = page.locator('[matsnackbarlabel]').last();
    this.options = page.locator('ng-dropdown-panel .ng-option');
  }

  // A draft saved earlier, by its id.
  async open(campaignId: string): Promise<void> {
    await this.page.goto(new URL(`/campaigns/app-push/create/${campaignId}`, appConfig.appUrl).toString(), {
      waitUntil: 'domcontentloaded',
    });
    await this.expectOpened();
  }

  async expectOpened(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.campaignName).not.toHaveValue('');
  }

  // The draft is named after its creation time, e.g. "19Nov2026-23:22 APP Push Campaign".
  async expectDefaults(): Promise<void> {
    await expect(this.campaignName).toHaveValue(/^\d{2}[A-Z][a-z]{2}\d{4}-\d{2}:\d{2} APP Push Campaign$/);
    await expect(this.category).toContainText('Select');
    await expect(this.appName).toContainText('Select');
    await expect(this.contactCount).toHaveText('0');
    await expect(this.removeDuplicates).not.toBeChecked();
    await expect(this.page.getByRole('radio', { name: 'From URL' })).toBeChecked();
    await expect(this.page.getByRole('radio', { name: 'Android' })).toBeChecked();
    await expect(this.page.locator('#customSwitch1')).not.toBeChecked();
    await expect(this.timezone).toContainText('(GMT+5:30) Asia/Kolkata (India Standard Time)');
    await expect(this.charCount).toHaveText('0/4000');
    await expect(this.editor).toHaveAttribute('contenteditable', 'false');
  }

  async categoryOptions(): Promise<string[]> {
    return this.optionsOf(this.category);
  }

  async appOptions(): Promise<string[]> {
    return this.optionsOf(this.appName);
  }

  async enterName(name: string): Promise<void> {
    await this.campaignName.fill(name);
  }

  async chooseCategory(category: string): Promise<void> {
    await this.pick(this.category, category);
  }

  async chooseApp(app: string): Promise<void> {
    await this.pick(this.appName, app);
  }

  // Opens the dialog, uploads the file, maps the two columns and imports. Returns the count.
  async importContacts(filePath: string, tokenColumn = 'Device Token', identifierColumn = 'Device Identifier'): Promise<number> {
    await this.openImport();
    await this.importDialog.upload(filePath);
    await this.importDialog.chooseColumns(tokenColumn, identifierColumn);
    return this.importDialog.import();
  }

  async openImport(): Promise<void> {
    await this.importContactsButton.click();
    await this.importDialog.expectOpen();
  }

  async expectContacts(count: number): Promise<void> {
    await expect(this.contactCount).toHaveText(String(count));
  }

  async expectContentLocked(locked: boolean): Promise<void> {
    await expect(this.editor).toHaveAttribute('contenteditable', locked ? 'false' : 'true');
  }

  async enterContent(content: PushContent): Promise<void> {
    await this.title.fill(content.title);

    if (content.imageUrl !== undefined) {
      await this.imageUrl.fill(content.imageUrl);
    }

    if (content.body !== undefined) {
      await this.editor.click();
      await this.page.keyboard.type(content.body);
    }
  }

  // Right-click in the body offers Personalise with the file's columns; a pick inserts <<Column>>.
  async personalise(column: string): Promise<void> {
    await this.editor.click();
    await this.editor.click({ button: 'right' });
    await this.page.getByRole('menuitem', { name: 'Personalise' }).click();
    await this.page.getByRole('menuitem', { name: column, exact: true }).click();
  }

  async personaliseColumns(): Promise<string[]> {
    await this.editor.click({ button: 'right' });
    await this.page.getByRole('menuitem', { name: 'Personalise' }).click();
    const items = (await this.page.getByRole('menuitem').allInnerTexts()).map((item) => item.trim());
    await this.page.keyboard.press('Escape');
    await this.page.keyboard.press('Escape');
    return items.filter((item) => item !== 'Personalise');
  }

  async expectBody(text: string): Promise<void> {
    await expect(this.editor).toHaveText(text);
  }

  // The counter counts a personalisation as the first contact's value, not as <<Column>>.
  async expectCharCount(count: number): Promise<void> {
    await expect(this.charCount).toHaveText(`${count}/4000`);
  }

  async expectTestTokensError(message: string): Promise<void> {
    await expect(this.page.locator('app-test-campaign').getByText(message, { exact: true })).toBeVisible();
  }

  // The phone preview shows the title and the body, with personalisation filled from the first
  // contact.
  async expectPreview(title: string, body = ''): Promise<void> {
    await expect(this.preview).toContainText(title);
    await expect(this.preview.locator('p')).toHaveText(body);
  }

  async chooseTestDevice(device: 'Android' | 'IOS'): Promise<void> {
    await this.page.getByRole('radio', { name: device, exact: true }).check({ force: true });
  }

  async enterTestTokens(tokens: string[]): Promise<void> {
    await this.testTokens.fill(tokens.join(','));
  }

  // Returns what the server said to the test send.
  async testNow(): Promise<PushTestResult> {
    const [response] = await Promise.all([
      this.page.waitForResponse((candidate) => isPushCall(candidate.request(), 'POST', /\/test-campaigns$/)),
      this.testNowButton.click(),
    ]);
    const body = (await response.json()) as { success: boolean; message: string };
    return { success: body.success, message: body.message };
  }

  // Test Now and Send that the form refuses: nothing reaches the server.
  async clickTestNow(): Promise<void> {
    await this.testNowButton.click();
  }

  // Send (or Schedule, with the switch on): the server counts the contacts and the summary opens.
  async send(): Promise<PushValidation> {
    const [response] = await Promise.all([
      this.page.waitForResponse((candidate) => isPushCall(candidate.request(), 'POST', /\/validate$/)),
      this.sendButton().click(),
    ]);
    const body = (await response.json()) as { data: PushValidation };
    await this.summary.expectOpen();
    return body.data;
  }

  async clickSend(): Promise<void> {
    await this.sendButton().click();
  }

  async expectSendLabel(label: 'Send' | 'Schedule'): Promise<void> {
    await expect(this.sendButton()).toHaveText(label);
  }

  async switchSchedule(): Promise<void> {
    await this.scheduleSwitch.click();
    await expect(this.page.locator('#customSwitch1')).toBeChecked();
  }

  // Picks the day in the calendar; the time stays at the current time. Days before today are
  // disabled.
  async scheduleOn(date: Date): Promise<string> {
    await this.scheduleInput.click();
    await expect(this.calendar).toBeVisible();

    if (date.getMonth() !== new Date().getMonth()) {
      await this.calendar.locator('.p-datepicker-next-button').click();
    }

    await this.enabledDays().filter({ hasText: new RegExp(`^\\s*${date.getDate()}\\s*$`) }).first().click();
    await expect(this.calendar).toBeHidden();
    return this.scheduleInput.inputValue();
  }

  // The days of the shown month the calendar lets you pick.
  async schedulableDays(): Promise<number[]> {
    await this.scheduleInput.click();
    await expect(this.calendar).toBeVisible();
    const days = (await this.enabledDays().allInnerTexts()).map(Number);
    await this.page.keyboard.press('Escape');
    return days;
  }

  async expectRefused(...messages: string[]): Promise<void> {
    await expect(this.snackbar).toHaveText('Please validate the form');

    for (const message of messages) {
      await expect(this.page.getByText(message, { exact: true }).first()).toBeVisible();
    }
  }

  async expectNotice(message: string | RegExp): Promise<void> {
    await expect(this.snackbar).toHaveText(message);
  }

  private sendButton(): Locator {
    return this.page.getByRole('button', { name: /^(Send|Schedule)$/ });
  }

  private enabledDays(): Locator {
    return this.calendar.locator('td:not(.p-datepicker-other-month) span:not(.p-disabled)');
  }

  private async optionsOf(select: Locator): Promise<string[]> {
    await select.click();
    const options = (await this.options.allInnerTexts()).map((option) => option.trim());
    await this.page.keyboard.press('Escape');
    return options;
  }

  private async pick(select: Locator, option: string): Promise<void> {
    await select.click();
    await this.options.filter({ hasText: new RegExp(`^\\s*${option}\\s*$`) }).click();
    await expect(select).toContainText(option);
  }
}

function isPushCall(request: Request, method: string, path: RegExp): boolean {
  return request.method() === method && request.url().includes('/app-push-campaign') && path.test(new URL(request.url()).pathname);
}
