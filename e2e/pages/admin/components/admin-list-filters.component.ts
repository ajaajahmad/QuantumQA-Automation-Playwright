import { expect, type Locator, type Page } from '@playwright/test';
import type { AdminTable, LoadedList } from './admin-table.component';

// The "Filter By" bar above a list (Admin Users has Role, Status and Expired At). Each filter is a
// button that opens a panel of checkbox options with Close and Apply; More Filter lists the filters
// with a checkbox each for whether it shows. An option's text sits beside its checkbox, not in its
// label, so the checkbox itself is what gets clicked. Option texts are read from the page source:
// the Role panel capitalises every word on screen ("notificationtest" shows as "Notificationtest").
export class AdminListFilters {
  private readonly page: Page;
  private readonly table: AdminTable;
  private readonly buttons: Locator;
  private readonly moreFilter: Locator;

  constructor(page: Page, table: AdminTable) {
    this.page = page;
    this.table = table;
    this.buttons = page.locator('button.sub-filter').filter({ visible: true });
    this.moreFilter = page.getByText('More Filter', { exact: true });
  }

  async expectFilters(names: string[]): Promise<void> {
    await expect(this.buttons).toHaveText(names);
  }

  // What a filter's button reads once options are applied.
  async expectButtonText(filter: string, text: string | RegExp): Promise<void> {
    await expect(this.button(filter)).toHaveText(text);
  }

  // The options a filter offers, in its order. The panel stays open afterwards.
  async options(filter: string): Promise<string[]> {
    await this.open(filter);
    return (await this.optionItems(filter).locator(optionText).allTextContents()).map((text) => text.trim());
  }

  // Types into the panel's own search box and returns the options still shown.
  async searchOptions(filter: string, text: string): Promise<string[]> {
    await this.open(filter);
    await this.panel(filter).getByRole('textbox').first().fill(text);
    return (await this.optionItems(filter).filter({ visible: true }).locator(optionText).allTextContents()).map((option) =>
      option.trim(),
    );
  }

  // Ticks the options and applies them; returns the list the filter loaded.
  async apply<T>(filter: string, options: string[]): Promise<LoadedList<T>> {
    await this.open(filter);

    for (const option of options) {
      await this.tick(this.option(filter, option));
    }

    return this.table.load<T>(() => this.panel(filter).getByRole('button', { name: 'Apply', exact: true }).click());
  }

  // Close shuts the panel without loading the list again.
  async close(filter: string): Promise<void> {
    await this.panel(filter).getByRole('button', { name: 'Close', exact: true }).click();
    await expect(this.panel(filter)).toBeHidden();
  }

  // Expired At holds one date, picked on a calendar that opens from its Choose Date box.
  async applyExpiry<T>(date: Date): Promise<LoadedList<T>> {
    await this.open('Expired At');
    await this.panel('Expired At').getByPlaceholder('Choose Date').click();
    const calendar = this.page.locator('.md-drppicker.shown').filter({ visible: true });
    await calendar.locator('select.yearselect').selectOption(String(date.getFullYear()));
    await calendar.locator('select.monthselect').selectOption(String(date.getMonth()));
    await calendar.locator('td.available:not(.off)').filter({ hasText: exactly(String(date.getDate())) }).first().click();
    return this.table.load<T>(() => this.panel('Expired At').getByRole('button', { name: 'Apply', exact: true }).click());
  }

  // More Filter lists every filter with a checkbox for whether its button shows. A filter that
  // always shows has its checkbox wrapped in a disabled span, so it can't be unticked.
  async moreFilterOptions(): Promise<{ filter: string; shown: boolean; locked: boolean }[]> {
    await this.openMoreFilter();
    const items = await this.moreFilterItems().all();

    return Promise.all(
      items.map(async (item) => ({
        filter: ((await item.locator(optionText).textContent()) ?? '').trim(),
        shown: await item.locator('input[type=checkbox]').isChecked(),
        locked: (await item.locator('span.disabled').count()) > 0,
      })),
    );
  }

  private async open(filter: string): Promise<void> {
    if (!(await this.panel(filter).isVisible())) {
      await this.button(filter).click();
    }

    await expect(this.panel(filter)).toBeVisible();
  }

  private async openMoreFilter(): Promise<void> {
    if (!(await this.moreFilterItems().first().isVisible())) {
      await this.moreFilter.click();
    }

    await expect(this.moreFilterItems().first()).toBeVisible();
  }

  private async tick(item: Locator): Promise<void> {
    const checkbox = item.locator('input[type=checkbox]');

    if (!(await checkbox.isChecked())) {
      await item.locator('.mdc-checkbox').click();
    }

    await expect(checkbox).toBeChecked();
  }

  // A ticked option adds to the button's text, so the button is matched by the name it starts with.
  private button(filter: string): Locator {
    return this.buttons.filter({ hasText: new RegExp(`^\\s*${escapeRegExp(filter)}(?![A-Za-z])`) });
  }

  // The panel follows its button.
  private panel(filter: string): Locator {
    return this.button(filter).locator('xpath=following-sibling::div[contains(@class,"sub-filter-div")][1]');
  }

  // The first item of each panel is its search box; the rest are options.
  private optionItems(filter: string): Locator {
    return this.panel(filter).locator('li[value]');
  }

  // Found from its text span up, since that span's selector can't sit inside a has filter.
  private option(filter: string, text: string): Locator {
    return this.optionItems(filter).locator(optionText).filter({ hasText: exactly(text) }).locator('xpath=ancestor::li[1]');
  }

  private moreFilterItems(): Locator {
    return this.moreFilter.locator('xpath=following::div[contains(@class,"sub-filter-div")][1]').locator('li[value]');
  }
}

// An option's text is the item's one span with no element inside; the other span holds the checkbox.
const optionText = 'span:not(:has(*))';

function exactly(text: string): RegExp {
  return new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
