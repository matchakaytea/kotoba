import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readSkinPicture, saveSkinPicture } from './skin-picture';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kotoba-skin-test-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const png = 'data:image/png;base64,iVBORw0KGgo=';
const jpeg = 'data:image/jpeg;base64,/9j/4AAQ';

describe('skin picture', () => {
  it('is saved in the data folder and read back', () => {
    expect(readSkinPicture(dir)).toBeNull();
    saveSkinPicture(dir, png);
    expect(fs.existsSync(path.join(dir, 'skin', 'picture.png'))).toBe(true);
    expect(readSkinPicture(dir)).toBe(png);
  });

  it('replaces the previous picture', () => {
    saveSkinPicture(dir, png);
    saveSkinPicture(dir, jpeg);
    expect(fs.readdirSync(path.join(dir, 'skin'))).toEqual(['picture.jpg']);
    expect(readSkinPicture(dir)).toBe(jpeg);
  });

  it('refuses anything that is not a picture', () => {
    expect(() => saveSkinPicture(dir, 'data:text/html;base64,PGI+')).toThrow();
    expect(() => saveSkinPicture(dir, 'hello')).toThrow();
  });
});
