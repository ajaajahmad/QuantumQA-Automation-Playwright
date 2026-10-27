import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

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
