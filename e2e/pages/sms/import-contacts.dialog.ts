import type { Locator, Page } from '@playwright/test';
import { DataTable } from '../components/data-table.component';

export class ImportContactsDialog {
  private readonly table: DataTable;
  private readonly listsTab: Locator;
  private readonly listSearchInput: Locator;
  private readonly goButton: Locator;
  private readonly importButton: Locator;

  constructor(page: Page) {
    this.table = new DataTable(page);
    this.listsTab = page.locator("//span[@class='mdc-tab__text-label'][contains(text(),'Lists')]");
    this.listSearchInput = page.locator("//input[@placeholder='Search List']");
    this.goButton = page.locator("//button[contains(text(),'Go')]");
    this.importButton = page.locator("//button[contains(@class,'process-file') and contains(normalize-space(),'Import')]");
  }

  async importList(listName: string): Promise<void> {
    await this.listsTab.click();
    await this.listSearchInput.fill(listName);
    await this.goButton.click();
    await this.table.checkRowByName(listName);
    await this.importButton.click();
  }
}
