// The web version keeps its database file and skin picture in IndexedDB.

import type { LocalPicture } from '../main/sync/sync';

const DB_NAME = 'kotoba';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function put(key: string, value: unknown): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export const loadDatabase = () => get<Uint8Array>('kotoba.db');
export const saveDatabase = (bytes: Uint8Array) => put('kotoba.db', bytes);
export const loadPicture = async () =>
  (await get<string>('skin-picture')) ?? null;
export const savePicture = (dataUrl: string) => put('skin-picture', dataUrl);

const PICTURE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
};

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** The picture in browser storage, for syncing it to other devices. */
export const storedPicture: LocalPicture = {
  read: async () => {
    const dataUrl = await loadPicture();
    if (!dataUrl) return null;
    return new Uint8Array(await (await fetch(dataUrl)).arrayBuffer());
  },
  write: async (bytes, name) => {
    const type = PICTURE_TYPES[name.split('.').pop() ?? ''];
    if (!type) throw new Error('Unknown picture type.');
    await savePicture(`data:${type};base64,${toBase64(bytes)}`);
  },
};
