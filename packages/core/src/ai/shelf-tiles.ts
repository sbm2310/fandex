/**
 * Where to cut a shelf photo before sending it to the model. A vision model sees each image
 * at a limited resolution, so a whole bookcase in one image leaves spines a few pixels wide
 * (it then misreads them or loops); the same photo cut into strips is read far better.
 * Strips run along the photo's long side and overlap, so a spine on a cut appears whole in
 * one of them.
 */

export type ImageSize = { width: number; height: number };

/** A crop rectangle in source-image pixels. */
export type ImageTile = { left: number; top: number; width: number; height: number };

export type TileOptions = {
  /** How many strips (Groq accepts at most 3 images per request). */
  count: number;
  /** Fraction of a strip shared with its neighbour. */
  overlap?: number;
};

export function planShelfTiles(
  size: ImageSize,
  { count, overlap = 0.1 }: TileOptions,
): ImageTile[] {
  const tiles = Math.max(1, Math.floor(count));
  if (tiles === 1) return [{ left: 0, top: 0, width: size.width, height: size.height }];

  // Portrait photos (a whole bookcase) are cut into horizontal bands, one or two shelves
  // each; landscape photos (one shelf, close up) into vertical columns.
  const vertical = size.width > size.height;
  const length = vertical ? size.width : size.height;
  // n strips of length s overlapping by overlap·s cover length = s·(n − (n − 1)·overlap).
  const strip = Math.ceil(length / (tiles - (tiles - 1) * overlap));
  const step = (length - strip) / (tiles - 1);

  return Array.from({ length: tiles }, (_, index) => {
    const start = Math.round(index * step);
    return vertical
      ? { left: start, top: 0, width: Math.min(strip, size.width - start), height: size.height }
      : { left: 0, top: start, width: size.width, height: Math.min(strip, size.height - start) };
  });
}
