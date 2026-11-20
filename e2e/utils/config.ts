import fs from 'node:fs';
import path from 'node:path';

type AppConfig = {
  appUrl: string;
  apiUrl: string;
  // Empty when admin_url isn't set, so a run without admin specs needs no admin settings.
  adminUrl: string;
  adminApiUrl: string;
  // The official email domain admin and sales users must have; empty skips the specs that create them.
  officialEmailDomain: string;
  timeoutMs: number;
  campaignCategory: string;
  smsSenderId: string;
  smsListName: string;
  smsTemplateName: string;
  wabaListName: string;
  wabaTemplateName: string;
  // The device token the App Push send specs push to; empty skips them.
  appPushDeviceToken: string;
  // The contacts file (uploaded on the App Push import dialog) the send spec sends to, by the start
  // of its name; staging adds the upload time to the name.
  appPushRecipientsFile: string;
};

const rootDir = path.resolve(__dirname, '../..');
const configPath = path.join(rootDir, 'config/qa.properties');

if (!fs.existsSync(configPath)) {
  throw new Error(`Missing ${configPath}. See the Setup section of the README for its keys.`);
}

const properties = readProperties(configPath);
const adminUrl = toFolderUrl(getConfigValue('admin_url', 'ADMIN_URL', ''));

export const appConfig: AppConfig = {
  appUrl: getConfigValue('app_url', 'APP_URL', 'https://example.com'),
  apiUrl: getRequiredConfigValue('api_url', 'API_URL'),
  adminUrl,
  // The admin panel serves its own API under its folder, e.g. <admin_url>api/v1/settings.
  adminApiUrl: adminUrl && new URL('api/v1', adminUrl).toString(),
  officialEmailDomain: getConfigValue('official_email_domain', 'OFFICIAL_EMAIL_DOMAIN', ''),
  timeoutMs: parseTimeoutSeconds(getConfigValue('timeout', 'TIMEOUT_SECONDS', '30')) * 1000,
  campaignCategory: getConfigValue('campaign_category', 'CAMPAIGN_CATEGORY', 'automation'),
  smsSenderId: getConfigValue('sms_sender_id', 'SMS_SENDER_ID', ''),
  smsListName: getConfigValue('sms_list_name', 'SMS_LIST_NAME', 'automation_sms'),
  smsTemplateName: getConfigValue('sms_template_name', 'SMS_TEMPLATE_NAME', 'test_template'),
  wabaListName: getConfigValue('waba_list_name', 'WABA_LIST_NAME', 'automation_waba'),
  wabaTemplateName: getConfigValue('waba_template_name', 'WABA_TEMPLATE_NAME', 'test_template'),
  appPushDeviceToken: getConfigValue('app_push_device_token', 'APP_PUSH_DEVICE_TOKEN', ''),
  appPushRecipientsFile: getConfigValue('app_push_recipients_file', 'APP_PUSH_RECIPIENTS_FILE', 'app_push_recipient'),
};

// Empty values are treated as unset so `APP_URL=` doesn't blank out the file value.
function getConfigValue(propertyKey: string, envKey: string, fallback: string): string {
  return process.env[envKey] || properties[propertyKey] || fallback;
}

// No fallback: a wrong API host would make every saved token look expired.
function getRequiredConfigValue(propertyKey: string, envKey: string): string {
  const value = process.env[envKey] || properties[propertyKey];

  if (!value) {
    throw new Error(`Missing ${propertyKey} in ${configPath}. See the Setup section of the README.`);
  }

  return value.replace(/\/+$/, '');
}

// Admin specs call this before using adminUrl, so a missing key fails with a pointer to the README
// instead of a navigation to an empty URL.
export function requireAdminUrl(): string {
  if (!appConfig.adminUrl) {
    throw new Error(`Missing admin_url in ${configPath}. See the Setup section of the README.`);
  }

  return appConfig.adminUrl;
}

// Sets one key in qa.properties, replacing its line or appending it, and keeps every other line as is.
export function saveConfigValue(propertyKey: string, value: string): void {
  if (properties[propertyKey] === value) {
    return;
  }

  const lines = fs.readFileSync(configPath, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim().startsWith(`${propertyKey}=`));

  if (index === -1) {
    lines.push(`${propertyKey}=${value}`);
  } else {
    lines[index] = `${propertyKey}=${value}`;
  }

  const tempPath = `${configPath}.tmp`;
  fs.writeFileSync(tempPath, `${lines.join('\n')}\n`, 'utf8');
  fs.renameSync(tempPath, configPath);
  properties[propertyKey] = value;
}

// The admin panel routes with a hash (#/auth/login). Keeps only its folder, ending in a slash,
// so '#/...' routes and 'api/v1' both resolve under it whatever form the URL was given in.
function toFolderUrl(value: string): string {
  if (!value) {
    return '';
  }

  const url = new URL(value);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/*$/, '/');
  return url.toString();
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
