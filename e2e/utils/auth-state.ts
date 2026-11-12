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

// The browser drops the token cookie an hour after login even while the API still accepts the
// token, and the app then shows the login page. Log in again when less than this is left, so a
// run can't cross the expiry halfway.
const minimumCookieLifeMs = 15 * 60 * 1000;

type Cookie = { name: string; value: string; expires: number };

// The app keeps its API token in this cookie and sends it as a Bearer header.
function readAccessTokenCookie(): Cookie | undefined {
  if (!fs.existsSync(storageStatePath)) {
    return undefined;
  }

  const { cookies } = JSON.parse(fs.readFileSync(storageStatePath, 'utf8')) as { cookies: Cookie[] };

  return cookies.find((cookie) => cookie.name === 'access-token');
}

export function readAccessToken(): string | undefined {
  return readAccessTokenCookie()?.value;
}

// Both must hold: the browser still has the cookie for long enough, and the API accepts the token
// (a password reset revokes it). expires is -1 for a cookie without an expiry.
export async function isSavedTokenValid(request: APIRequestContext): Promise<boolean> {
  const cookie = readAccessTokenCookie();

  if (!cookie || !readSessionState()) {
    return false;
  }

  if (cookie.expires !== -1 && cookie.expires * 1000 - Date.now() < minimumCookieLifeMs) {
    return false;
  }

  const response = await request.get(`${appConfig.apiUrl}/api/v1/users/user-currency`, {
    headers: { Authorization: `Bearer ${cookie.value}` },
  });

  return response.ok();
}
