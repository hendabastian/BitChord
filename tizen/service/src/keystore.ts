import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const STORE_PATH = process.env.BITCHORD_DATA_DIR
  ? join(process.env.BITCHORD_DATA_DIR, 'store.json')
  : '/tmp/bitchord-tv-store.json';

interface StoreData {
  cookie?: string;
  activeProfileId?: string;
  profilePins?: Record<string, string>;
  settings?: Record<string, unknown>;
}

let cache: StoreData = {};

export function loadStore(): StoreData {
  try {
    if (existsSync(STORE_PATH)) {
      cache = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
    }
  } catch {
    cache = {};
  }
  return cache;
}

export function saveStore(data: Partial<StoreData>): void {
  cache = { ...cache, ...data };
  try {
    writeFileSync(STORE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    console.warn('[keystore] Failed to save store', e);
  }
}

export function getAuthCookie(): string | undefined {
  return loadStore().cookie;
}

export function setAuthCookie(cookie: string): void {
  saveStore({ cookie });
}

export function getProfilePin(profileId: string): string | undefined {
  return loadStore().profilePins?.[profileId];
}

export function setProfilePin(profileId: string, pin: string): void {
  const current = loadStore();
  const pins = { ...(current.profilePins || {}), [profileId]: pin };
  saveStore({ profilePins: pins });
}

