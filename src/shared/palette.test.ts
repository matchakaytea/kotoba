import { describe, expect, it } from 'vitest';
import {
  buildPalette,
  contrast,
  extractSwatches,
  hexToRgb,
  rgbToHex,
  suggestColors,
  type ThemeMode,
} from './palette';

function pixels(...groups: [hex: string, count: number][]): number[] {
  const data: number[] = [];
  for (const [hex, count] of groups) {
    const { r, g, b } = hexToRgb(hex);
    for (let i = 0; i < count; i++) data.push(r, g, b, 255);
  }
  return data;
}

describe('hex conversion', () => {
  it('round-trips', () => {
    expect(rgbToHex(hexToRgb('#f4a7c1'))).toBe('#f4a7c1');
  });
});

describe('extractSwatches', () => {
  it('finds the main colours, most common first', () => {
    const swatches = extractSwatches(
      pixels(['#f6c6d6', 700], ['#c2185b', 200], ['#ffffff', 100]),
      3,
    );
    expect(swatches.map((s) => s.hex)).toEqual([
      '#f6c6d6',
      '#c2185b',
      '#ffffff',
    ]);
    expect(swatches[0].share).toBeCloseTo(0.7);
  });

  it('ignores transparent pixels', () => {
    const data = [...pixels(['#f6c6d6', 10]), 0, 0, 0, 0, 0, 0, 0, 0];
    expect(extractSwatches(data, 3)).toEqual([{ hex: '#f6c6d6', share: 1 }]);
  });

  it('returns nothing for an empty picture', () => {
    expect(extractSwatches([])).toEqual([]);
  });
});

describe('suggestColors', () => {
  it('uses the main colour as background and a vivid one as accent', () => {
    const swatches = extractSwatches(
      pixels(['#f6c6d6', 700], ['#c2185b', 150], ['#eeeeee', 150]),
    );
    expect(suggestColors(swatches)).toEqual({
      base: '#f6c6d6',
      accent: '#c2185b',
      mode: 'light',
    });
  });

  it('chooses dark mode for a dark picture', () => {
    const swatches = extractSwatches(
      pixels(['#101830', 800], ['#2fd5ff', 200]),
    );
    expect(suggestColors(swatches).mode).toBe('dark');
  });

  it('invents an accent when the picture has a single colour', () => {
    const suggestion = suggestColors(extractSwatches(pixels(['#f6c6d6', 100])));
    expect(suggestion.base).toBe('#f6c6d6');
    expect(suggestion.accent).not.toBe('#f6c6d6');
  });
});

describe('buildPalette', () => {
  it('keeps a pink picture pink', () => {
    const palette = buildPalette({
      base: '#f6c6d6',
      accent: '#c2185b',
      mode: 'light',
    });
    const { r, g, b } = hexToRgb(palette['--bg']);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b - 5);
  });

  it('stays readable for any colours, in light and dark', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const randomHex = () =>
      rgbToHex({ r: random() * 255, g: random() * 255, b: random() * 255 });

    for (let i = 0; i < 500; i++) {
      const mode: ThemeMode = i % 2 === 0 ? 'light' : 'dark';
      const p = buildPalette({ base: randomHex(), accent: randomHex(), mode });
      const where = `${mode} #${i}`;
      expect(contrast(p['--text'], p['--bg']), where).toBeGreaterThanOrEqual(7);
      expect(
        contrast(p['--text'], p['--surface']),
        where,
      ).toBeGreaterThanOrEqual(7);
      expect(
        contrast(p['--muted'], p['--surface']),
        where,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(p['--accent'], p['--surface']),
        where,
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrast(p['--on-accent'], p['--accent']),
        where,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(p['--nav-active-text'], p['--accent-soft']),
        where,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
