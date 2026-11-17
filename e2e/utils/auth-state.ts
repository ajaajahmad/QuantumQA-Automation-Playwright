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

// One app's saved login: where it is kept, the cookie the app keeps its API token in, and how to
// ask the API whether that token is still accepted.
export type AppSession = {
  storageStatePath: string;
  sessionStatePath: string;
  tokenCookie: string;
  tokenCheckUrl: string;
  authorization: (token: string) => string;
};

export const authDir = path.resolve(__dirname, '../../artifacts/.auth');

export const panelSession: AppSession = {
  storageStatePath: path.join(authDir, 'storage-state.json'),
  sessionStatePath: path.join(authDir, 'session-state.json'),
  tokenCookie: 'access-token',
  tokenCheckUrl: `${appConfig.apiUrl}/api/v1/users/user-currency`,
  authorization: (token) => `Bearer ${token}`,
};

export async function saveAuthState(page: Page, session: AppSession): Promise<void> {
  fs.mkdirSync(authDir, { recursive: true });

  await page.context().storageState({ path: session.storageStatePath });

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

  fs.writeFileSync(session.sessionStatePath, JSON.stringify(sessionState, null, 2));
}

export function readSessionState(session: AppSession): SessionState | undefined {
  if (!fs.existsSync(session.sessionStatePath)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(session.sessionStatePath, 'utf8')) as SessionState;
}

// The browser drops the token cookie when it expires even while the API still accepts the token
// (an hour after login on the panel), and the app then shows the login page. Log in again when
// less than this is left, so a run can't cross the expiry halfway.
const minimumCookieLifeMs = 15 * 60 * 1000;

type Cookie = { name: string; value: string; expires: number };

function readAccessTokenCookie(session: AppSession): Cookie | undefined {
  if (!fs.existsSync(session.storageStatePath)) {
    return undefined;
  }

  const { cookies } = JSON.parse(fs.readFileSync(session.storageStatePath, 'utf8')) as { cookies: Cookie[] };

  return cookies.find((cookie) => cookie.name === session.tokenCookie);
}

export function readAccessToken(session: AppSession): string | undefined {
  return readAccessTokenCookie(session)?.value;
}

// Both must hold: the browser still has the cookie for long enough, and the API accepts the token
// (a password reset revokes it). expires is -1 for a cookie without an expiry.
export async function isSavedTokenValid(request: APIRequestContext, session: AppSession): Promise<boolean> {
  const cookie = readAccessTokenCookie(session);

  if (!cookie || !readSessionState(session)) {
    return false;
  }

  if (cookie.expires !== -1 && cookie.expires * 1000 - Date.now() < minimumCookieLifeMs) {
    return false;
  }

  const response = await request.get(session.tokenCheckUrl, {
    headers: { Authorization: session.authorization(cookie.value) },
  });

  return response.ok();
}
