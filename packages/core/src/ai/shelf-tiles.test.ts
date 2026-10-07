import { planShelfTiles, type ImageTile } from './shelf-tiles';

const covers = (tiles: ImageTile[], axis: 'left' | 'top', length: number) => {
  const size = axis === 'left' ? 'width' : 'height';
  const first = tiles[0]!;
  const last = tiles[tiles.length - 1]!;
  return first[axis] === 0 && last[axis] + last[size] === length;
};

describe('planShelfTiles', () => {
  it('returns the whole image for one tile', () => {
    expect(planShelfTiles({ width: 2048, height: 1536 }, { count: 1 })).toEqual([
      { left: 0, top: 0, width: 2048, height: 1536 },
    ]);
  });

  it('cuts a landscape photo (one shelf) into overlapping columns', () => {
    const tiles = planShelfTiles({ width: 2000, height: 500 }, { count: 2, overlap: 0.1 });

    expect(tiles).toHaveLength(2);
    expect(tiles.every((tile) => tile.top === 0 && tile.height === 500)).toBe(true);
    expect(covers(tiles, 'left', 2000)).toBe(true);
    // Each is a bit over half, and they share 10% of a strip.
    expect(tiles[0]!.width).toBe(1053);
    expect(tiles[0]!.left + tiles[0]!.width - tiles[1]!.left).toBe(106);
  });

  it('cuts a portrait photo (a bookcase) into horizontal bands', () => {
    const tiles = planShelfTiles({ width: 1536, height: 2048 }, { count: 3 });

    expect(tiles).toHaveLength(3);
    expect(tiles.every((tile) => tile.left === 0 && tile.width === 1536)).toBe(true);
    expect(covers(tiles, 'top', 2048)).toBe(true);
    for (let i = 1; i < tiles.length; i++) {
      const previous = tiles[i - 1]!;
      expect(tiles[i]!.top).toBeLessThan(previous.top + previous.height); // overlapping
    }
  });

  it('never leaves the image', () => {
    for (const count of [2, 3, 4, 5]) {
      for (const tile of planShelfTiles({ width: 1001, height: 333 }, { count, overlap: 0.15 })) {
        expect(tile.left).toBeGreaterThanOrEqual(0);
        expect(tile.left + tile.width).toBeLessThanOrEqual(1001);
      }
    }
  });
});
