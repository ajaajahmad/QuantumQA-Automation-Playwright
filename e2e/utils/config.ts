import fs from 'node:fs';
import path from 'node:path';

type BrowserName = 'chromium' | 'firefox' | 'webkit';

type AppConfig = {
  appUrl: string;
  browser: BrowserName;
  timeoutMs: number;
  headless: boolean;
  excelSheetName: string;
  smsListName: string;
  smsTemplateName: string;
  wabaListName: string;
  wabaTemplateName: string;
};

const rootDir = path.resolve(__dirname, '../..');
const configPath = firstExistingPath([
  path.join(rootDir, 'config/qa.properties'),
  path.join(rootDir, 'config/config.example.properties'),
]);

const properties = readProperties(configPath);

export const appConfig: AppConfig = {
  appUrl: getConfigValue('app_url', 'APP_URL', 'https://example.com'),
  browser: normalizeBrowser(getConfigValue('browser', 'BROWSER', 'chromium')),
  timeoutMs: Number(getConfigValue('timeout', 'TIMEOUT_SECONDS', '30')) * 1000,
  headless: getConfigValue('headless', 'HEADLESS', 'true').toLowerCase() !== 'false',
  excelSheetName: getConfigValue('excel_sheet_name', 'EXCEL_SHEET_NAME', 'Sheet1'),
  smsListName: getConfigValue('sms_list_name', 'SMS_LIST_NAME', 'automation_sms'),
  smsTemplateName: getConfigValue('sms_template_name', 'SMS_TEMPLATE_NAME', 'test_template'),
  wabaListName: getConfigValue('waba_list_name', 'WABA_LIST_NAME', 'automation_waba'),
  wabaTemplateName: getConfigValue('waba_template_name', 'WABA_TEMPLATE_NAME', 'test_template'),
};

function getConfigValue(propertyKey: string, envKey: string, fallback: string): string {
  return process.env[envKey] ?? properties[propertyKey] ?? fallback;
}

function normalizeBrowser(browser: string): BrowserName {
  const value = browser.toLowerCase();

  if (value === 'chrome' || value === 'chromium') {
    return 'chromium';
  }

  if (value === 'firefox' || value === 'webkit') {
    return value;
  }

  if (value === 'edge') {
    return 'chromium';
  }

  throw new Error(`Unsupported Playwright browser: ${browser}`);
}

function firstExistingPath(paths: string[]): string {
  const match = paths.find((candidate) => fs.existsSync(candidate));

  if (!match) {
    throw new Error(`No Playwright config file found. Checked: ${paths.join(', ')}`);
  }

  return match;
}

function readProperties(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, 'utf8');

  return content.split(/\r?\n/).reduce<Record<string, string>>((accumulator, line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return accumulator;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      return accumulator;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    accumulator[key] = value;
    return accumulator;
  }, {});
}
