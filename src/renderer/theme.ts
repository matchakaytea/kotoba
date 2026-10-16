import type { Theme } from '../shared/api';
import {
  buildPalette,
  extractSwatches,
  type CustomColors,
  type Swatch,
} from '../shared/palette';

let customVariables: string[] = [];

export function applyTheme(
  theme: Theme,
  colors: CustomColors | undefined,
): void {
  const root = document.documentElement;
  for (const name of customVariables) root.style.removeProperty(name);
  customVariables = [];

  if (theme === 'default' || (theme === 'custom' && !colors)) {
    delete root.dataset.theme;
    return;
  }
  root.dataset.theme = theme;
  if (theme === 'custom' && colors) {
    const palette = buildPalette(colors);
    for (const [name, value] of Object.entries(palette)) {
      root.style.setProperty(name, value);
    }
    root.style.setProperty('color-scheme', colors.mode);
    customVariables = [...Object.keys(palette), 'color-scheme'];
  }
}

export function swatchesFromPicture(dataUrl: string): Promise<Swatch[]> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 120 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas is not available.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      const found = extractSwatches(data, 8);
      resolve(
        found.filter((swatch, i) => i < 2 || swatch.share >= 0.01).slice(0, 6),
      );
    };
    image.onerror = () => reject(new Error('Could not read the picture.'));
    image.src = dataUrl;
  });
}
