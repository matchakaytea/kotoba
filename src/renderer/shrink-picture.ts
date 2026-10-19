// Wallpapers sync between devices, so a picked photo is shrunk to screen size
// first: a 4–10 MB photo usually ends up a few hundred KB.
const MAX_SIDE = 2560;
const MAX_BYTES = 3 * 1024 * 1024;
const QUALITIES = [0.85, 0.72, 0.6];

function load(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read the picture.'));
    image.src = dataUrl;
  });
}

/** Bytes in a base64 data URL, without decoding it. */
function sizeOf(dataUrl: string): number {
  return Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
}

/** The picture as a JPEG at most 2560 px on its longest side. */
export async function shrinkPicture(dataUrl: string): Promise<string> {
  const image = await load(dataUrl);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available.');
  // JPEG has no transparency; see-through parts become white.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of QUALITIES) {
    const shrunk = canvas.toDataURL('image/jpeg', quality);
    if (sizeOf(shrunk) <= MAX_BYTES) return shrunk;
  }
  throw new Error('That picture is too large to use, even after shrinking.');
}
