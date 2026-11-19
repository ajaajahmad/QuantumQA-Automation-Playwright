import { expect, type Locator, type Page, type Response } from '@playwright/test';

export type UserFormSection = 'Basic Information' | 'Additional Information' | 'SMPP Configuration';

export type SmppSettings = {
  username: string;
  shortcode: string;
  allowedIps: string;
  maxTransmitterSessions: number;
  maxReceiverSessions: number;
  maxTransceiverSessions: number;
};

export type SmppField = keyof SmppSettings;

export type SaveResult = { status: number; success: boolean; message: string };

// The SMPP inputs, by the field names GET users/form/input gives them. The schema marks all six
// disabled on create and on edit; Enable SMPP is what should unlock them.
export const smppFieldId: Record<SmppField, string> = {
  username: 'smpp_username',
  shortcode: 'smpp_shortcode',
  allowedIps: 'smpp_allowed_ip',
  maxTransmitterSessions: 'smpp_max_transmitter_session',
  maxReceiverSessions: 'smpp_max_receiver_session',
  maxTransceiverSessions: 'smpp_max_transreceiver_session',
};

const smppFieldIds = Object.values(smppFieldId);

// The admin panel's form builder, shared by Create User and a user's edit page (built from GET
// users/form/input in collapsible sections, whose closed sections' fields are not in the page) and
// by the Admin group's forms (admin users, roles and sales users).
export class UserForm {
  private readonly page: Page;
  private readonly smppEnable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.smppEnable = page.locator('label.checkbox').filter({ hasText: 'Enable SMPP' });
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

  // Types key by key and leaves the field, for fields whose handlers listen for keys or blur
  // rather than input (Create Admin User copies User Name into Email this way).
  async typeText(id: string, value: string): Promise<void> {
    const field = this.page.locator(`#${id}`);
    await field.fill('');
    await field.pressSequentially(value);
    await field.press('Tab');
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

  // The options an ng-select offers, as its panel lists them; the panel is closed afterwards.
  async options(label: string): Promise<string[]> {
    await this.field(label).locator('ng-select').first().click();
    const options = this.page.locator('ng-dropdown-panel .ng-option');
    await expect(options.first()).toBeVisible();
    const texts = (await options.allInnerTexts()).map((text) => text.trim());
    await this.page.keyboard.press('Escape');
    return texts;
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

  async expectEditable(id: string, editable: boolean): Promise<void> {
    await expect(this.page.locator(`#${id}`)).toBeEditable({ editable });
  }

  // The values an ng-select shows as picked; picking one of them again in a multi-select drops it.
  async picked(label: string): Promise<string[]> {
    return (await this.field(label).locator('.ng-value-label').allTextContents()).map((value) => value.trim());
  }

  // What an ng-select shows as picked: one value, or every value of a multi-select.
  async expectPicked(label: string, values: string[]): Promise<void> {
    await expect(this.field(label).locator('.ng-value-label')).toHaveText(values);
  }

  async expectChosen(group: string, option: string): Promise<void> {
    const choice = this.field(group)
      .locator('.form-check')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(option)}\\s*$`) });
    await expect(choice.locator('input')).toBeChecked();
  }

  // A form checkbox carries its text in its label, under a styled checkmark that takes the click.
  async setTicked(label: string, ticked: boolean): Promise<void> {
    await this.checkbox(label).setChecked(ticked, { force: true });
  }

  async expectTicked(label: string, ticked: boolean): Promise<void> {
    await expect(this.checkbox(label)).toBeChecked({ checked: ticked });
  }

  // The number beside the country code, and the code the picker shows (+91).
  async expectMobile(countryCode: string, mobile: string): Promise<void> {
    await expect(this.field('Mobile').locator('ng-select .ng-value-label')).toHaveText(countryCode);
    await expect(this.field('Mobile').locator('.country_code input')).toHaveValue(mobile);
  }

  // The form's one date field (Expires On, labelled with "(optional)"): a read-only input that opens
  // a calendar with month and year selects, where past days are disabled.
  async pickDate(date: Date): Promise<void> {
    await this.page.locator('form input[name="dp"]').click();
    const calendar = this.page.locator('.md-drppicker.shown');
    await calendar.locator('select.yearselect').selectOption(String(date.getFullYear()));
    await calendar.locator('select.monthselect').selectOption(String(date.getMonth()));
    await calendar
      .locator('td.available:not(.off)')
      .filter({ hasText: new RegExp(`^\\s*${date.getDate()}\\s*$`) })
      .first()
      .click();
    await this.expectDate(date);
  }

  // The field shows dates as dd/mm/yyyy, sometimes with a trailing space.
  async expectDate(date: Date): Promise<void> {
    const shown = [date.getDate(), date.getMonth() + 1].map((part) => String(part).padStart(2, '0'));
    await expect(this.page.locator('form input[name="dp"]')).toHaveValue(
      new RegExp(`^\\s*${shown.join('/')}/${date.getFullYear()}\\s*$`),
    );
  }

  // A read-only input that opens a calendar with month and year selects; a day click applies it.
  async pickExpiryDate(year: number): Promise<void> {
    await this.field('Expires On').locator('input[name="dp"]').click();
    const calendar = this.page.locator('.md-drppicker.shown');
    await calendar.locator('select.yearselect').selectOption(String(year));
    await calendar.locator('td.available:not(.off)').filter({ hasText: /^15$/ }).first().click();
  }

  async tickEnableSmpp(): Promise<void> {
    await this.openSection('SMPP Configuration');
    const enabled = this.smppEnable.locator('input');

    if (!(await enabled.isChecked())) {
      await this.smppEnable.locator('.checkmark').click();
    }

    await expect(enabled).toBeChecked();
  }

  async expectSmppEnabled(enabled: boolean): Promise<void> {
    await this.openSection('SMPP Configuration');
    await expect(this.smppEnable.locator('input')).toBeChecked({ checked: enabled });
  }

  // Checks all six fields in one assertion, so a failure names every field in the wrong state.
  async expectSmppFieldsEditable(editable: boolean): Promise<void> {
    await this.openSection('SMPP Configuration');
    await expect(this.page.locator(`#${smppFieldIds[0]}`)).toBeVisible();

    await expect
      .poll(
        async () => {
          const wrong: string[] = [];
          for (const id of smppFieldIds) {
            if ((await this.page.locator(`#${id}`).isEditable()) !== editable) wrong.push(id);
          }
          return wrong;
        },
        { message: editable ? 'SMPP fields that refuse input' : 'SMPP fields that accept input' },
      )
      .toEqual([]);
  }

  async untickEnableSmpp(): Promise<void> {
    await this.openSection('SMPP Configuration');
    const enabled = this.smppEnable.locator('input');

    if (await enabled.isChecked()) {
      await this.smppEnable.locator('.checkmark').click();
    }

    await expect(enabled).not.toBeChecked();
  }

  // One SMPP field, for the negative cases. The session counts are number inputs, so the browser
  // refuses text like "abc" there; such values go through the API instead.
  async enterSmppField(field: SmppField, value: string): Promise<void> {
    await this.openSection('SMPP Configuration');
    await this.fillText(smppFieldId[field], value);
  }

  // Ticks Enable SMPP unless it already is, then fills every SMPP field. The fields take input
  // before the box is ticked, and their maxlength cuts the username at 15 and the shortcode at 20.
  async enterSmpp(smpp: SmppSettings): Promise<void> {
    await this.tickEnableSmpp();
    await this.fillText('smpp_username', smpp.username);
    await this.fillText('smpp_shortcode', smpp.shortcode);
    await this.fillText('smpp_allowed_ip', smpp.allowedIps);
    await this.fillText('smpp_max_transmitter_session', String(smpp.maxTransmitterSessions));
    await this.fillText('smpp_max_receiver_session', String(smpp.maxReceiverSessions));
    await this.fillText('smpp_max_transreceiver_session', String(smpp.maxTransceiverSessions));
  }

  async expectSmpp(smpp: SmppSettings): Promise<void> {
    await this.openSection('SMPP Configuration');
    await expect(this.smppEnable.locator('input')).toBeChecked();
    await this.expectText('smpp_username', smpp.username);
    await this.expectText('smpp_shortcode', smpp.shortcode);
    await this.expectText('smpp_allowed_ip', smpp.allowedIps);
    await this.expectText('smpp_max_transmitter_session', String(smpp.maxTransmitterSessions));
    await this.expectText('smpp_max_receiver_session', String(smpp.maxReceiverSessions));
    await this.expectText('smpp_max_transreceiver_session', String(smpp.maxTransceiverSessions));
  }

  private checkbox(label: string): Locator {
    return this.page
      .locator('form label.checkbox')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`) })
      .locator('input[type=checkbox]');
  }

  // The labels' for attributes hold their text instead of an input id, so fields are found by
  // the container around the label.
  private field(label: string): Locator {
    return this.page.locator(
      `xpath=//label[normalize-space()='${label}']/parent::div[contains(@class,'field-label')]/parent::*`,
    );
  }
}

// What the server said to a save; the page itself shows nothing for some failures. A refused
// save says only "Http Exception" and names the reasons per field under data.errors.
export async function readSaveResult(response: Response): Promise<SaveResult> {
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    data?: { errors?: Record<string, string> };
  };
  const reasons = Object.values(body.data?.errors ?? {});
  return {
    status: response.status(),
    success: body.success === true,
    message: [body.message ?? '', ...reasons].filter(Boolean).join(': '),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
