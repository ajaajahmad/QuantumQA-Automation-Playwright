import { expect, type Locator, type Page, type Response } from '@playwright/test';

export type UserFormSection = 'Basic Information' | 'Additional Information' | 'SMPP Configuration';

export type SaveResult = { status: number; success: boolean; message: string };

// The form Create User and a user's edit page share. The app builds it from GET users/form/input
// in collapsible sections, and a closed section's fields are not in the page.
export class UserForm {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async openSection(title: UserFormSection): Promise<void> {
    const toggle = this.page.locator('button.accordion-button').filter({ hasText: title });

    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      await toggle.click();
    }

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }

  // Text, number and textarea fields carry their field name as id.
  async fillText(id: string, value: string): Promise<void> {
    await this.page.locator(`#${id}`).fill(value);
  }

  async expectText(id: string, value: string): Promise<void> {
    await expect(this.page.locator(`#${id}`)).toHaveValue(value);
  }

  // Types the search text and clicks the option whose whole text matches it, unless a pattern
  // says otherwise (time zones read like "(GMT+5:30) Asia/Kolkata (India Standard Time)").
  async pick(label: string, search: string, option?: RegExp): Promise<void> {
    const select = this.field(label).locator('ng-select').first();
    await select.click();
    await select.locator('input').fill(search);
    await this.page
      .locator('ng-dropdown-panel .ng-option')
      .filter({ hasText: option ?? new RegExp(`^\\s*${escapeRegExp(search)}\\s*$`) })
      .first()
      .click();
  }

  async pickFirst(label: string): Promise<void> {
    await this.field(label).locator('ng-select').first().click();
    await this.page.locator('ng-dropdown-panel .ng-option').first().click();
  }

  // The radio inputs sit under a styled checkmark that takes the click, so that is what is clicked.
  async choose(group: string, option: string): Promise<void> {
    const choice = this.field(group)
      .locator('.form-check')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(option)}\\s*$`) });
    await choice.locator('.checkmark').click();
    await expect(choice.locator('input')).toBeChecked();
  }

  // Country code first (India, +91), then the number.
  async enterMobile(mobile: string): Promise<void> {
    const mobileField = this.field('Mobile');
    await mobileField.locator('ng-select').click();
    await mobileField.locator('ng-select input').fill('91');
    await this.page.locator('ng-dropdown-panel .ng-option').filter({ hasText: /\+91\b|India/ }).first().click();
    await mobileField.locator('.country_code input').fill(mobile);
  }

  // A read-only input that opens a calendar with month and year selects; a day click applies it.
  async pickExpiryDate(year: number): Promise<void> {
    await this.field('Expires On').locator('input[name="dp"]').click();
    const calendar = this.page.locator('.md-drppicker.shown');
    await calendar.locator('select.yearselect').selectOption(String(year));
    await calendar.locator('td.available:not(.off)').filter({ hasText: /^15$/ }).first().click();
  }

  // The labels' for attributes hold their text instead of an input id, so fields are found by
  // the container around the label.
  private field(label: string): Locator {
    return this.page.locator(
      `xpath=//label[normalize-space()='${label}']/parent::div[contains(@class,'field-label')]/parent::*`,
    );
  }
}

// What the server said to a save; the page itself shows nothing for some failures.
export async function readSaveResult(response: Response): Promise<SaveResult> {
  const body = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string };
  return { status: response.status(), success: body.success === true, message: body.message ?? '' };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
