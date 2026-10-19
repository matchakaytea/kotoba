import fs from 'node:fs';
import path from 'node:path';
import type { LocalPicture } from './sync/sync';

// The custom skin's picture lives in the data folder as skin/picture.<ext>.
const DATA_URL =
  /^data:image\/(png|jpeg|webp|gif|bmp);base64,([A-Za-z0-9+/=]+)$/;
const EXTENSIONS: Record<string, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  gif: 'gif',
  bmp: 'bmp',
};
const TYPES: Record<string, string> = {
  png: 'png',
  jpg: 'jpeg',
  webp: 'webp',
  gif: 'gif',
  bmp: 'bmp',
};

function skinDir(dataDir: string): string {
  return path.join(dataDir, 'skin');
}

function existing(dataDir: string): string | undefined {
  const dir = skinDir(dataDir);
  if (!fs.existsSync(dir)) return undefined;
  const name = fs.readdirSync(dir).find((file) => /^picture\./.test(file));
  return name ? path.join(dir, name) : undefined;
}

/** Saves the picture and returns its file extension. */
export function saveSkinPicture(dataDir: string, dataUrl: string): string {
  const match = DATA_URL.exec(dataUrl);
  if (!match) throw new Error('That is not a picture Kotoba can use.');
  const extension = EXTENSIONS[match[1]];
  writeSkinPicture(dataDir, Buffer.from(match[2], 'base64'), extension);
  return extension;
}

function writeSkinPicture(
  dataDir: string,
  bytes: Uint8Array,
  extension: string,
): void {
  const dir = skinDir(dataDir);
  fs.mkdirSync(dir, { recursive: true });
  const old = existing(dataDir);
  if (old) fs.rmSync(old);
  fs.writeFileSync(path.join(dir, `picture.${extension}`), bytes);
}

/** The picture file, for syncing it to other devices. */
export function skinPictureFile(dataDir: string): LocalPicture {
  return {
    read: async () => {
      const file = existing(dataDir);
      return file ? new Uint8Array(fs.readFileSync(file)) : null;
    },
    write: async (bytes, name) => {
      const extension = path.extname(name).slice(1);
      if (!TYPES[extension]) throw new Error('Unknown picture type.');
      writeSkinPicture(dataDir, bytes, extension);
    },
  };
}

/** The saved picture as a data URL, or null when there is none. */
export function readSkinPicture(dataDir: string): string | null {
  const file = existing(dataDir);
  if (!file) return null;
  const type = TYPES[path.extname(file).slice(1)];
  if (!type) return null;
  return `data:image/${type};base64,${fs.readFileSync(file).toString('base64')}`;
}
