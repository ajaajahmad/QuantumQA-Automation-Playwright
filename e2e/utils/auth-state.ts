import fs from 'node:fs';
import path from 'node:path';
import type { APIRequestContext, Page } from '@playwright/test';
import { appConfig } from './config';

export type StorageEntry = {
  key: string;
  value: string;
};

export type SessionState = {
  origin: string;
  sessionStorage: StorageEntry[];
};

export const authDir = path.resolve(__dirname, '../../artifacts/.auth');
export const storageStatePath = path.join(authDir, 'storage-state.json');
export const sessionStatePath = path.join(authDir, 'session-state.json');

export async function saveAuthState(page: Page): Promise<void> {
  fs.mkdirSync(authDir, { recursive: true });

  await page.context().storageState({ path: storageStatePath });

  const sessionState = await page.evaluate<SessionState>(() => {
    const toEntries = (storage: Storage): StorageEntry[] =>
      Array.from({ length: storage.length }, (_, index) => {
        const key = storage.key(index) ?? '';
        return { key, value: storage.getItem(key) ?? '' };
      }).filter((entry) => entry.key);

    return {
      origin: window.location.origin,
      sessionStorage: toEntries(window.sessionStorage),
    };
  });

  fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
}

export function readSessionState(): SessionState | undefined {
  if (!fs.existsSync(sessionStatePath)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(sessionStatePath, 'utf8')) as SessionState;
}

// The app keeps its API token in this cookie and sends it as a Bearer header.
export function readAccessToken(): string | undefined {
  if (!fs.existsSync(storageStatePath)) {
    return undefined;
  }

  const { cookies } = JSON.parse(fs.readFileSync(storageStatePath, 'utf8')) as {
    cookies: { name: string; value: string }[];
  };

  return cookies.find((cookie) => cookie.name === 'access-token')?.value;
}

// Tokens expire after about an hour and a password reset revokes them, so ask the API.
export async function isSavedTokenValid(request: APIRequestContext): Promise<boolean> {
  const token = readAccessToken();

  if (!token || !readSessionState()) {
    return false;
  }

  const response = await request.get(`${appConfig.apiUrl}/api/v1/users/user-currency`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.ok();
}
