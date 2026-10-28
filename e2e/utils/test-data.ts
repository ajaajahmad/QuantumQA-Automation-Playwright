import fs from 'node:fs';
import path from 'node:path';

export type UserCredentials = {
  username: string;
  password: string;
};

export type ForgotPasswordAccount = {
  username: string;
  mobileLast4: string;
  otp: string;
};

// A row with mobileLast4 is the forgot-password account. It has no fixed password,
// because the forgot-password spec resets it on every run.
type UserDataRow = Partial<UserCredentials & ForgotPasswordAccount>;

const rootDir = path.resolve(__dirname, '../..');
const dataPath = path.join(rootDir, 'e2e/test-data/userdata.json');

function readUserDataRows(): UserDataRow[] {
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Missing Playwright user data file: ${dataPath}`);
  }

  return JSON.parse(fs.readFileSync(dataPath, 'utf8')) as UserDataRow[];
}

function isForgotPasswordRow(row: UserDataRow): boolean {
  return row.mobileLast4 !== undefined;
}

export function readUserCredentials(): UserCredentials[] {
  const validRows = readUserDataRows().filter(
    (row): row is UserCredentials =>
      !isForgotPasswordRow(row) && Boolean(row.username?.trim() && row.password?.trim()),
  );

  if (validRows.length === 0) {
    throw new Error(`No valid user credentials found in ${dataPath}`);
  }

  return validRows;
}

// Optional: without a forgot-password row the forgot-password spec is skipped, not failed.
export function readForgotPasswordAccount(): ForgotPasswordAccount | undefined {
  const rows = readUserDataRows().filter(isForgotPasswordRow);

  if (rows.length === 0) {
    return undefined;
  }

  const [account] = rows;

  if (rows.length > 1 || !account.username?.trim() || !/^\d{4}$/.test(account.mobileLast4 ?? '') || !account.otp?.trim()) {
    throw new Error(`${dataPath} needs exactly one forgot-password row with a username, 4-digit mobileLast4 and otp.`);
  }

  return account as ForgotPasswordAccount;
}
