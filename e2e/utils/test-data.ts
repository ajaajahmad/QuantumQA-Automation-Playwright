import fs from 'node:fs';
import path from 'node:path';

export type UserCredentials = {
  username: string;
  password: string;
};

const rootDir = path.resolve(__dirname, '../..');

export function readUserCredentials(): UserCredentials[] {
  const dataPath = path.join(rootDir, 'e2e/test-data/userdata.json');

  if (!fs.existsSync(dataPath)) {
    throw new Error(`Missing Playwright user data file: ${dataPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as UserCredentials[];
  const validRows = parsed.filter((row) => row.username?.trim() && row.password?.trim());

  if (validRows.length === 0) {
    throw new Error(`No valid user credentials found in ${dataPath}`);
  }

  return validRows;
}
