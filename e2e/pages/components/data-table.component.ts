import { expect, type Locator, type Page } from '@playwright/test';
import { xpathLiteral } from '../../utils/xpath';

export class DataTable {
  constructor(private readonly page: Page) {}

  async checkRowByName(name: string): Promise<void> {
    const row = this.rowBySecondCellText(name);
    const checkboxInput = row.locator("mat-checkbox input[type='checkbox']");

    await row.waitFor({ state: 'visible' });
    await checkboxInput.check();

    const checkbox = row.locator('mat-checkbox');
    await expect(checkbox).toHaveClass(/mat-mdc-checkbox-checked/);
  }

  async chooseRowByName(name: string): Promise<void> {
    const row = this.rowBySecondCellText(name);
    const radio = row.locator("input[type='radio']");

    await row.waitFor({ state: 'visible' });
    await radio.check();
    await expect(radio).toBeChecked();
  }

  // The lists search API can return the same row twice, so take the first match.
  private rowBySecondCellText(text: string): Locator {
    return this.page
      .locator(
        `//tbody//tr[.//td[2]//span[contains(@class,'table-data-row') and normalize-space()=${xpathLiteral(text)}]]`,
      )
      .first();
  }
}
