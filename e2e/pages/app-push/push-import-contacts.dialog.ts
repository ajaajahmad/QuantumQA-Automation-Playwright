import { expect, type Locator, type Page, type Response } from '@playwright/test';

// What the server said about an upload: the stored name (the original with a timestamp added),
// the headers it found and how many rows sit under them.
export type UploadedFile = { id: string; name: string; headers: string[]; rows: number };

// What the preview of a file uploaded before answered: its full name, the status, the raw reply,
// and on success its rows, header row first.
export type ExistingFilePreview = { name: string; status: number; body: string; rows: string[][] };

// Step 2's Import Contacts dialog on the App Push create page: upload a file (or pick one uploaded
// before), say which columns hold the device token and the device identifier, then import.
export class PushImportContactsDialog {
  private readonly dialog: Locator;
  private readonly fileInput: Locator;
  private readonly existingFile: Locator;
  private readonly uploaded: Locator;
  private readonly selects: Locator;
  private readonly sheet: Locator;
  private readonly previewButton: Locator;
  private readonly previewTable: Locator;
  private readonly count: Locator;
  private readonly importButton: Locator;
  private readonly options: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.locator('.app-modal.modal-active').filter({ hasText: 'Import Contacts' });
    this.fileInput = this.dialog.locator('input[type=file]');
    this.existingFile = this.dialog.locator('ng-select').filter({ hasText: 'Existing File' });
    this.uploaded = this.dialog.getByText('File Uploaded Successfully.');
    this.selects = this.dialog.locator('ng-select');
    this.sheet = this.dialog.locator('ng-select').filter({ hasText: 'Sheet' });
    this.previewButton = this.dialog.getByRole('button', { name: 'Preview', exact: true });
    this.previewTable = this.dialog.locator('table');
    this.count = this.dialog.getByText(/^\s*Count:/);
    this.importButton = this.dialog.getByRole('button', { name: 'Import', exact: true });
    this.options = page.locator('ng-dropdown-panel .ng-option');
  }

  async expectOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByText('Format Accepted: .csv .xls .txt .xlsx .xlsb .zip')).toBeVisible();
  }

  async upload(filePath: string): Promise<UploadedFile> {
    const [response] = await Promise.all([
      this.page.waitForResponse((candidate) => isCall(candidate, 'POST', /\/app-push-campaign\/files$/)),
      this.fileInput.setInputFiles(filePath),
    ]);
    const { data } = (await response.json()) as {
      data: { _id: string; original_name: string; sheets: { headers: string[]; data_count: number }[] };
    };
    await expect(this.uploaded).toBeVisible();
    return { id: data._id, name: data.original_name, headers: data.sheets[0].headers, rows: data.sheets[0].data_count };
  }

  // The files uploaded before, newest first, as the Existing File list names them.
  async existingFiles(): Promise<string[]> {
    await this.existingFile.click();
    const names = (await this.options.allInnerTexts()).map((name) => name.trim());
    await this.page.keyboard.press('Escape');
    return names;
  }

  // Picks a file uploaded before by (the start of) its name and returns what its preview
  // answered. A CSV previews on the pick; a spreadsheet first asks for a sheet, whose list starts
  // with a Select placeholder.
  async chooseExisting(name: string, sheet = 'Sheet1'): Promise<ExistingFilePreview> {
    await this.existingFile.click();
    const file = this.options.filter({ hasText: name }).first();
    const fullName = (await file.innerText()).trim();
    const preview = this.page.waitForResponse((candidate) =>
      isCall(candidate, 'GET', /\/app-push-campaign\/view-file-data$/),
    );

    if (fullName.toLowerCase().endsWith('.csv')) {
      await file.click();
    } else {
      await file.click();
      await this.sheet.click();
      await this.options.filter({ hasText: new RegExp(`^\\s*${sheet}\\s*$`) }).click();
    }

    const response = await preview;
    const body = await response.text();
    const rows = response.ok() ? ((JSON.parse(body) as { data: string[][] }).data ?? []) : [];
    return { name: fullName, status: response.status(), body, rows };
  }

  // The column lists offer every header of the file.
  async expectColumnChoices(headers: string[]): Promise<void> {
    const [tokenColumn] = await this.columnSelects();
    await tokenColumn.click();
    await expect(this.options).toHaveText(['Select', ...headers]);
    await this.page.keyboard.press('Escape');
  }

  async chooseColumns(token: string, identifier: string): Promise<void> {
    const [tokenColumn, identifierColumn] = await this.columnSelects();
    await this.pick(tokenColumn, token);
    await this.pick(identifierColumn, identifier);
  }

  async chooseTokenColumn(token: string): Promise<void> {
    const [tokenColumn] = await this.columnSelects();
    await this.pick(tokenColumn, token);
  }

  // The preview shows the header row and then the file's rows, cell by cell.
  async expectPreview(rows: string[][]): Promise<void> {
    await this.previewButton.click();
    await expect(this.previewTable.locator('tr')).toHaveCount(rows.length);

    for (const [index, cells] of rows.entries()) {
      await expect(this.previewTable.locator('tr').nth(index).locator('th, td')).toHaveText(cells);
    }
  }

  async expectCount(contacts: number): Promise<void> {
    await expect(this.count).toHaveText(new RegExp(`^\\s*Count:\\s*${contacts}\\s*Contacts\\s*$`));
  }

  // Returns how many contacts the server imported; the dialog closes on success.
  async import(): Promise<number> {
    const [response] = await Promise.all([
      this.page.waitForResponse((candidate) => isCall(candidate, 'POST', /\/app-push-campaign\/import-file$/)),
      this.importButton.click(),
    ]);
    const body = (await response.json()) as { success: boolean; message: string; data: { data_count: number } };
    expect(body.success, body.message).toBe(true);
    await expect(this.dialog).toBeHidden();
    return body.data.data_count;
  }

  // Import without both columns chosen sends nothing and keeps the dialog open.
  async importRefused(): Promise<void> {
    const requests: string[] = [];
    const record = (request: { url(): string }) => requests.push(request.url());
    this.page.on('request', record);
    await this.importButton.click();
    await expect(this.dialog).toBeVisible();
    this.page.off('request', record);
    expect(requests.filter((url) => url.includes('/import-file'))).toEqual([]);
  }

  // The token and identifier lists are the dialog's last two selects (a spreadsheet's Sheet list
  // comes before them). They are found by position because a pick replaces the placeholder that
  // names them.
  private async columnSelects(): Promise<[Locator, Locator]> {
    await expect.poll(() => this.selects.count(), { message: 'the column lists' }).toBeGreaterThanOrEqual(2);
    const count = await this.selects.count();
    return [this.selects.nth(count - 2), this.selects.nth(count - 1)];
  }

  private async pick(select: Locator, option: string): Promise<void> {
    await select.click();
    await this.options.filter({ hasText: new RegExp(`^\\s*${option}\\s*$`) }).click();
    await expect(select).toContainText(option);
  }
}

function isCall(response: Response, method: string, path: RegExp): boolean {
  return response.request().method() === method && path.test(new URL(response.url()).pathname);
}
