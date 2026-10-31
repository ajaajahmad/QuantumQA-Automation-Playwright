import fs from 'node:fs';
import path from 'node:path';

export type UserCredentials = {
  username: string;
  password: string;
  otp?: string;
};

export type ForgotPasswordAccount = UserCredentials & {
  mobileLast4: string;
  otp: string;
};

// Mirrors the keys in userdata.json. The forgot-password fields are optional per row.
type UserDataRow = {
  username?: string;
  password?: string;
  mobile_last_four_digits?: string;
  one_time_password?: string;
};

const rootDir = path.resolve(__dirname, '../..');
const dataPath = path.join(rootDir, 'e2e/test-data/userdata.json');

function readUserDataRows(): UserDataRow[] {
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Missing Playwright user data file: ${dataPath}`);
  }

  return JSON.parse(fs.readFileSync(dataPath, 'utf8')) as UserDataRow[];
}

export function readUserCredentials(): UserCredentials[] {
  const validRows = readUserDataRows()
    .filter((row) => row.username?.trim() && row.password?.trim())
    .map((row) => ({ username: row.username!, password: row.password!, otp: row.one_time_password }));

  if (validRows.length === 0) {
    throw new Error(`No valid user credentials found in ${dataPath}`);
  }

  return validRows;
}

// Optional: without a row that has the forgot-password fields, that spec is skipped, not failed.
export function readForgotPasswordAccount(): ForgotPasswordAccount | undefined {
  const row = readUserDataRows().find((candidate) => candidate.mobile_last_four_digits !== undefined);

  if (!row) {
    return undefined;
  }

  if (
    !row.username?.trim() ||
    !row.password?.trim() ||
    !/^\d{4}$/.test(row.mobile_last_four_digits ?? '') ||
    !row.one_time_password?.trim()
  ) {
    throw new Error(
      `${dataPath}: the forgot-password row needs username, password, a 4-digit mobile_last_four_digits and one_time_password.`,
    );
  }

  return {
    username: row.username,
    password: row.password,
    mobileLast4: row.mobile_last_four_digits!,
    otp: row.one_time_password,
  };
}
