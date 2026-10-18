import fs from 'node:fs';
import path from 'node:path';

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

export function saveSkinPicture(dataDir: string, dataUrl: string): void {
  const match = DATA_URL.exec(dataUrl);
  if (!match) throw new Error('That is not a picture Kotoba can use.');
  const dir = skinDir(dataDir);
  fs.mkdirSync(dir, { recursive: true });
  const old = existing(dataDir);
  if (old) fs.rmSync(old);
  fs.writeFileSync(
    path.join(dir, `picture.${EXTENSIONS[match[1]]}`),
    Buffer.from(match[2], 'base64'),
  );
}

/** The saved picture as a data URL, or null when there is none. */
export function readSkinPicture(dataDir: string): string | null {
  const file = existing(dataDir);
  if (!file) return null;
  const type = TYPES[path.extname(file).slice(1)];
  if (!type) return null;
  return `data:image/${type};base64,${fs.readFileSync(file).toString('base64')}`;
}
