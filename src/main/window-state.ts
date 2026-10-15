import fs from 'node:fs';
import { z } from 'zod';

export const DEFAULT_BOUNDS = { width: 1200, height: 800 };
export const MIN_SIZE = { width: 900, height: 640 };

const WindowState = z.object({
  width: z.number().int().min(MIN_SIZE.width),
  height: z.number().int().min(MIN_SIZE.height),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  maximized: z.boolean().default(false),
});

export type WindowState = z.infer<typeof WindowState>;

type Area = { x: number; y: number; width: number; height: number };

export function loadWindowState(file: string, displays: Area[]): WindowState {
  try {
    const state = WindowState.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (state.x === undefined || state.y === undefined) return state;
    const visible = displays.some((area) =>
      overlaps(state as Required<WindowState>, area),
    );
    return visible ? state : { ...state, x: undefined, y: undefined };
  } catch {
    return { ...DEFAULT_BOUNDS, maximized: false };
  }
}

export function saveWindowState(file: string, state: WindowState): void {
  try {
    fs.writeFileSync(file, JSON.stringify(state), 'utf8');
  } catch {
    // Losing the window size is not worth interrupting the user over.
  }
}

function overlaps(window: Required<WindowState>, area: Area): boolean {
  const visibleWidth =
    Math.min(window.x + window.width, area.x + area.width) -
    Math.max(window.x, area.x);
  const visibleHeight =
    Math.min(window.y + window.height, area.y + area.height) -
    Math.max(window.y, area.y);
  return visibleWidth >= 100 && visibleHeight >= 100;
}
