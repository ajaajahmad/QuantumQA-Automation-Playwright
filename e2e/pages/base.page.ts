import type { Locator, Page } from '@playwright/test';

export abstract class BasePage {
  protected readonly page: Page;

  protected constructor(page: Page) {
    this.page = page;
  }

  protected async click(locator: Locator): Promise<void> {
    await locator.click();
  }

  protected async type(locator: Locator, text: string): Promise<void> {
    await locator.fill(text);
  }

  protected async typeAndEnter(locator: Locator, text: string): Promise<void> {
    await locator.fill(text);
    await locator.press('Enter');
  }
}

export function xpathLiteral(value: string): string {
  if (!value.includes("'")) {
    return `'${value}'`;
  }

  if (!value.includes('"')) {
    return `"${value}"`;
  }

  return `concat('${value.replace(/'/g, `', "'", '`)}')`;
}
