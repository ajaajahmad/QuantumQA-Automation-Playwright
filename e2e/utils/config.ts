import fs from 'node:fs';
import path from 'node:path';

type AppConfig = {
  appUrl: string;
  timeoutMs: number;
  smsListName: string;
  smsTemplateName: string;
  wabaListName: string;
  wabaTemplateName: string;
};

const rootDir = path.resolve(__dirname, '../..');
const configPath = path.join(rootDir, 'config/qa.properties');

if (!fs.existsSync(configPath)) {
  throw new Error(`Missing ${configPath}. See the Setup section of the README for its keys.`);
}

const properties = readProperties(configPath);

export const appConfig: AppConfig = {
  appUrl: getConfigValue('app_url', 'APP_URL', 'https://example.com'),
  timeoutMs: parseTimeoutSeconds(getConfigValue('timeout', 'TIMEOUT_SECONDS', '30')) * 1000,
  smsListName: getConfigValue('sms_list_name', 'SMS_LIST_NAME', 'automation_sms'),
  smsTemplateName: getConfigValue('sms_template_name', 'SMS_TEMPLATE_NAME', 'test_template'),
  wabaListName: getConfigValue('waba_list_name', 'WABA_LIST_NAME', 'automation_waba'),
  wabaTemplateName: getConfigValue('waba_template_name', 'WABA_TEMPLATE_NAME', 'test_template'),
};

// Empty values are treated as unset so `APP_URL=` doesn't blank out the file value.
function getConfigValue(propertyKey: string, envKey: string, fallback: string): string {
  return process.env[envKey] || properties[propertyKey] || fallback;
}

function parseTimeoutSeconds(value: string): number {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Invalid timeout "${value}": expected a positive number of seconds.`);
  }

  return seconds;
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
