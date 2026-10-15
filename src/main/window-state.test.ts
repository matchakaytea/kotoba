import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadWindowState, saveWindowState } from './window-state';

const screen = [{ x: 0, y: 0, width: 1920, height: 1080 }];
let dir: string;
let file: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kotoba-window-'));
  file = path.join(dir, 'window-state.json');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('window state', () => {
  it('starts at the default size when nothing is saved', () => {
    expect(loadWindowState(file, screen)).toEqual({
      width: 1200,
      height: 800,
      maximized: false,
    });
  });

  it('restores what was saved', () => {
    const state = { width: 1400, height: 900, x: 100, y: 50, maximized: true };
    saveWindowState(file, state);
    expect(loadWindowState(file, screen)).toEqual(state);
  });

  it('forgets the position when that screen is gone', () => {
    saveWindowState(file, {
      width: 1200,
      height: 800,
      x: 3000,
      y: 100,
      maximized: false,
    });
    expect(loadWindowState(file, screen)).toEqual({
      width: 1200,
      height: 800,
      x: undefined,
      y: undefined,
      maximized: false,
    });
  });

  it('ignores a size below the minimum or a broken file', () => {
    fs.writeFileSync(file, JSON.stringify({ width: 300, height: 200 }));
    expect(loadWindowState(file, screen).width).toBe(1200);
    fs.writeFileSync(file, '{ broken');
    expect(loadWindowState(file, screen).width).toBe(1200);
  });
});
