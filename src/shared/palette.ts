export type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

export type ThemeMode = 'light' | 'dark';

export type CustomColors = {
  base: string;
  accent: string;
  mode: ThemeMode;
};

export type Swatch = { hex: string; share: number };

export function hexToRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

function hsl(h: number, s: number, l: number): string {
  return rgbToHex(hslToRgb({ h, s: clamp(s), l: clamp(l) }));
}

function clamp(n: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, n));
}

export function luminance(hex: string): number {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function distance(a: Rgb, b: Rgb): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

/** Finds the main colours in RGBA pixel data, most common first. */
export function extractSwatches(
  pixels: ArrayLike<number>,
  count = 6,
): Swatch[] {
  const points: Rgb[] = [];
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    points.push({ r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] });
  }
  if (points.length === 0) return [];

  const centers: Rgb[] = [points[0]];
  while (centers.length < count) {
    let farthest = points[0];
    let best = -1;
    for (const point of points) {
      const nearest = Math.min(...centers.map((c) => distance(point, c)));
      if (nearest > best) {
        best = nearest;
        farthest = point;
      }
    }
    if (best < 1) break;
    centers.push(farthest);
  }

  let sizes: number[] = [];
  for (let round = 0; round < 8; round++) {
    const sums = centers.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (const point of points) {
      let index = 0;
      let nearest = Infinity;
      centers.forEach((center, i) => {
        const d = distance(point, center);
        if (d < nearest) {
          nearest = d;
          index = i;
        }
      });
      const sum = sums[index];
      sum.r += point.r;
      sum.g += point.g;
      sum.b += point.b;
      sum.n++;
    }
    sums.forEach((sum, i) => {
      if (sum.n > 0)
        centers[i] = { r: sum.r / sum.n, g: sum.g / sum.n, b: sum.b / sum.n };
    });
    sizes = sums.map((sum) => sum.n);
  }

  return centers
    .map((center, i) => ({
      hex: rgbToHex(center),
      share: sizes[i] / points.length,
    }))
    .filter((swatch) => swatch.share > 0)
    .sort((a, b) => b.share - a.share);
}

/** Picks a starting background and accent from the swatches. */
export function suggestColors(swatches: Swatch[]): CustomColors {
  const base = swatches[0]?.hex ?? '#f7f7f4';
  const baseHsl = rgbToHsl(hexToRgb(base));
  const candidates = swatches.slice(1).filter((swatch) => swatch.share >= 0.02);
  const score = (hex: string) => {
    const { s, l } = rgbToHsl(hexToRgb(hex));
    return (
      s * (1 - Math.abs(l - 0.5)) +
      distance(hexToRgb(hex), hexToRgb(base)) / 441
    );
  };
  const accent =
    candidates.sort((a, b) => score(b.hex) - score(a.hex))[0]?.hex ??
    hsl(baseHsl.h, Math.max(baseHsl.s, 0.55), 0.45);
  return { base, accent, mode: baseHsl.l < 0.35 ? 'dark' : 'light' };
}

function readable(
  color: Hsl,
  against: string,
  minimum: number,
  mode: ThemeMode,
): string {
  let { l } = color;
  for (let step = 0; step < 60; step++) {
    const hex = hsl(color.h, color.s, l);
    if (contrast(hex, against) >= minimum) return hex;
    l += mode === 'light' ? -0.02 : 0.02;
  }
  return mode === 'light' ? '#000000' : '#ffffff';
}

/** Turns two colours into every colour variable the app uses. */
export function buildPalette({
  base,
  accent,
  mode,
}: CustomColors): Record<string, string> {
  const b = rgbToHsl(hexToRgb(base));
  const a = rgbToHsl(hexToRgb(accent));
  const tint = Math.min(b.s, 0.55);
  const light = mode === 'light';

  const bg = light ? hsl(b.h, tint, 0.955) : hsl(b.h, tint * 0.6, 0.1);
  const surface = light
    ? hsl(b.h, tint * 0.8, 0.985)
    : hsl(b.h, tint * 0.55, 0.14);
  const sidebar = light ? hsl(b.h, tint, 0.915) : hsl(b.h, tint * 0.6, 0.075);
  const text = readable(
    { h: b.h, s: tint * 0.6, l: light ? 0.2 : 0.9 },
    bg,
    10,
    mode,
  );
  const muted = readable(
    { h: b.h, s: tint * 0.4, l: light ? 0.45 : 0.68 },
    surface,
    4.6,
    mode,
  );
  const faint = readable(
    { h: b.h, s: tint * 0.3, l: light ? 0.6 : 0.52 },
    surface,
    2.6,
    mode,
  );

  let accentHex = readable(
    { h: a.h, s: Math.max(a.s, 0.45), l: a.l },
    surface,
    3.2,
    mode,
  );
  const labelContrast = (hex: string) =>
    Math.max(contrast('#ffffff', hex), contrast('#111111', hex));
  for (let step = 0; step < 40 && labelContrast(accentHex) < 4.6; step++) {
    const current = rgbToHsl(hexToRgb(accentHex));
    accentHex = hsl(current.h, current.s, current.l + (light ? -0.02 : 0.02));
  }
  const onAccent =
    contrast('#ffffff', accentHex) >= contrast('#111111', accentHex)
      ? '#ffffff'
      : '#111111';
  const accentL = rgbToHsl(hexToRgb(accentHex)).l;

  return {
    '--bg': bg,
    '--surface': surface,
    '--sidebar': sidebar,
    '--text': text,
    '--muted': muted,
    '--faint': faint,
    '--border': light ? hsl(b.h, tint * 0.7, 0.86) : hsl(b.h, tint * 0.5, 0.24),
    '--border-strong': light
      ? hsl(b.h, tint * 0.7, 0.78)
      : hsl(b.h, tint * 0.5, 0.32),
    '--hover': light ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.06)',
    '--accent': accentHex,
    '--accent-hover': hsl(
      a.h,
      Math.max(a.s, 0.45),
      light ? accentL - 0.06 : accentL + 0.06,
    ),
    '--accent-soft': light
      ? hsl(a.h, Math.max(a.s, 0.4) * 0.8, 0.9)
      : hsl(a.h, Math.max(a.s, 0.4) * 0.6, 0.2),
    '--on-accent': onAccent,
    '--nav-active-text': readable(
      { h: a.h, s: Math.max(a.s, 0.45), l: a.l },
      light
        ? hsl(a.h, Math.max(a.s, 0.4) * 0.8, 0.9)
        : hsl(a.h, Math.max(a.s, 0.4) * 0.6, 0.2),
      4.5,
      mode,
    ),
    '--correct': light ? '#15803d' : '#4ade80',
    '--correct-soft': light ? '#dcfce7' : '#14301f',
    '--wrong': light ? '#b91c1c' : '#f87171',
    '--wrong-soft': light ? '#fee2e2' : '#3b1717',
    '--warning': light ? '#a16207' : '#fbbf24',
    '--warning-soft': light ? '#fef3c7' : '#3a2c0b',
  };
}
