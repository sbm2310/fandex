import { planShelfTiles } from '@fandex/core';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** A photo as the image picker returns it. */
export type ShelfPhoto = { uri: string; width: number; height: number };

/** A prepared JPEG part of the photo (a file on native, a blob/data URL on web). */
export type ShelfImage = { uri: string; width: number; height: number };

/**
 * Halves, as measured in docs/eval/shelf-recognition.md: a one-shelf photo read in two
 * overlapping halves found the most items.
 */
const PARTS = 2;
/** Long edge of each part: as sharp as the model uses, and well under the API's 2 MB. */
const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.8;

/** Cuts a shelf photo into overlapping halves (core's `planShelfTiles`), resized as JPEGs. */
export async function prepareShelfImages(photo: ShelfPhoto): Promise<ShelfImage[]> {
  const tiles = planShelfTiles(photo, { count: PARTS });
  const images: ShelfImage[] = [];
  // One at a time: each part of a 12-megapixel photo is a large bitmap in memory.
  for (const tile of tiles) {
    const scale = Math.min(1, MAX_EDGE / Math.max(tile.width, tile.height));
    const context = ImageManipulator.manipulate(photo.uri).crop({
      originX: tile.left,
      originY: tile.top,
      width: tile.width,
      height: tile.height,
    });
    if (scale < 1) {
      context.resize({
        width: Math.round(tile.width * scale),
        height: Math.round(tile.height * scale),
      });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
    images.push({ uri: saved.uri, width: saved.width, height: saved.height });
  }
  return images;
}
