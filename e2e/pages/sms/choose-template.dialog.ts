import type { Locator, Page } from '@playwright/test';
import { DataTable } from '../components/data-table.component';

export class ChooseTemplateDialog {
  private readonly table: DataTable;
  private readonly searchInput: Locator;
  private readonly saveButton: Locator;

  constructor(page: Page) {
    this.table = new DataTable(page);
    this.searchInput = page.locator("//input[contains(@class,'filter-search')]");
    this.saveButton = page.locator('button.import-btn.btn-design');
  }

  async chooseTemplate(templateName: string): Promise<void> {
    await this.searchInput.fill(templateName);
    await this.searchInput.press('Enter');
    await this.table.chooseRowByName(templateName);
    await this.saveButton.click();
  }
}
