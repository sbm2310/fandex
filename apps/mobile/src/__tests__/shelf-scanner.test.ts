import type { CatalogItemResponse, ShelfScanItem, ShelfScanResponse } from '@fandex/core';

import { prepareShelfImages } from '@/services/shelf-photo';
import { ApiShelfScanner, ShelfScanError, toShelfScanError } from '@/services/shelf-scanner';
import {
  chooseCandidate,
  chosenEntries,
  initialChoices,
  reviewOrder,
  toggleChoice,
} from '@/utils/shelf-selection';

// Image manipulation is native; record what was asked of it instead.
const mockSaved: { crop: unknown; resize?: unknown; compress?: number }[] = [];
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (uri: string) => {
      const step: { crop: unknown; resize?: unknown; compress?: number } = { crop: null };
      const context = {
        crop: (rect: unknown) => ((step.crop = rect), context),
        resize: (size: unknown) => ((step.resize = size), context),
        renderAsync: async () => ({
          saveAsync: async ({ compress }: { compress: number }) => {
            step.compress = compress;
            mockSaved.push(step);
            return { uri: `${uri}#${mockSaved.length}`, width: 10, height: 10 };
          },
        }),
      };
      return context;
    },
  },
}));

// Expo's native fetch only uploads expo-file-system Files (see form-image.ts).
jest.mock('expo-file-system', () => ({
  // A Blob, so the test environment's FormData accepts it.
  File: class MockFile extends Blob {
    uri: string;
    constructor(mockUri: string) {
      super([]);
      this.uri = mockUri;
    }
  },
}));

const item = (id: string, title: string, category = 'manga'): CatalogItemResponse =>
  ({
    id,
    category,
    source: 'openlibrary',
    externalId: id,
    title,
    creators: ['Takehiko Inoue'],
    universes: [],
    characters: [],
  }) as CatalogItemResponse;

describe('prepareShelfImages', () => {
  beforeEach(() => (mockSaved.length = 0));

  it('cuts a landscape shelf photo into two overlapping halves, resized for the model', async () => {
    const images = await prepareShelfImages({
      uri: 'file:///shelf.jpg',
      width: 4032,
      height: 3024,
    });

    expect(images.map((image) => image.uri)).toEqual([
      'file:///shelf.jpg#1',
      'file:///shelf.jpg#2',
    ]);
    const [left, right] = mockSaved as { crop: { originX: number; width: number } }[];
    expect(left!.crop).toMatchObject({ originX: 0, originY: 0, height: 3024 });
    // Overlapping: the right half starts before the left one ends.
    expect(right!.crop.originX).toBeLessThan(left!.crop.width);
    expect(right!.crop.originX + right!.crop.width).toBe(4032);
    // Long edge down to 2048 px, JPEG at 80%.
    expect(mockSaved[0]!.resize).toEqual({ width: 1438, height: 2048 });
    expect(mockSaved[0]!.compress).toBe(0.8);
  });

  it("doesn't enlarge a small photo", async () => {
    await prepareShelfImages({ uri: 'file:///small.jpg', width: 1200, height: 600 });

    expect(mockSaved.every((step) => step.resize === undefined)).toBe(true);
  });
});

describe('ApiShelfScanner', () => {
  const response = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const photo = { uri: 'file:///shelf.jpg', width: 2000, height: 600 };
  const result: ShelfScanResponse = {
    items: [
      { reading: { kind: 'manga', title: 'Vagabond', count: 8 }, sure: true, candidates: [] },
    ],
    quota: { used: 2, limit: 5 },
  };

  it('uploads the halves as one multipart request and returns the result', async () => {
    const apiFetch = jest.fn(async (_path: string, _init?: RequestInit) => response(200, result));
    const append = jest.spyOn(FormData.prototype, 'append');
    mockSaved.length = 0;

    expect(await new ApiShelfScanner(apiFetch).scan(photo)).toEqual(result);

    const [path, init] = apiFetch.mock.calls[0]!;
    expect(path).toBe('/ai/shelf-scans');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
    // Files, not React Native's { uri, name, type } parts, which expo/fetch can't send.
    const { File } = jest.requireMock<{ File: new (uri: string) => unknown }>('expo-file-system');
    expect(append.mock.calls).toEqual([
      ['images', expect.any(File), 'shelf-1.jpg'],
      ['images', expect.any(File), 'shelf-2.jpg'],
    ]);
    expect(append.mock.calls.map(([, file]) => (file as unknown as { uri: string }).uri)).toEqual([
      'file:///shelf.jpg#1',
      'file:///shelf.jpg#2',
    ]);
    append.mockRestore();
  });

  it('reads the allowance', async () => {
    const quota = { available: true, shelfScans: { used: 1, limit: 5 } };
    const apiFetch = jest.fn(async () => response(200, quota));

    expect(await new ApiShelfScanner(apiFetch).quota()).toEqual(quota);
    expect(apiFetch).toHaveBeenCalledWith('/ai/quota', undefined);
  });

  it.each([
    [
      429,
      { message: "You've used today's 5 shelf scans." },
      'quota',
      "You've used today's 5 shelf scans.",
    ],
    [
      503,
      { message: 'Shelf scanning is busy. Try again in a minute.' },
      'busy',
      'Shelf scanning is busy. Try again in a minute.',
    ],
    [401, {}, 'signed-out', 'Sign in to scan a shelf.'],
    [500, {}, 'failed', "Couldn't read this photo. Try again."],
  ])('turns %i into an error the screen can show (%#)', async (status, body, kind, message) => {
    const apiFetch = jest.fn(async () => response(status, body));

    await expect(new ApiShelfScanner(apiFetch).scan(photo)).rejects.toMatchObject({
      kind,
      message,
    });
  });

  it('reports an unreachable server as a network error', async () => {
    const apiFetch = jest.fn(async () => Promise.reject(new TypeError('Network request failed')));

    const error = await new ApiShelfScanner(apiFetch).quota().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ShelfScanError);
    expect(error).toMatchObject({ kind: 'network' });
  });
});

describe('toShelfScanError', () => {
  it('keeps a scan error, recognized by its kind', () => {
    const busy = new ShelfScanError('busy', 'Busy');
    const lookalike = Object.assign(new Error('Busy'), { kind: 'busy' });

    expect(toShelfScanError(busy)).toBe(busy);
    expect(toShelfScanError(lookalike)).toBe(lookalike);
  });

  it('turns anything else into a general failure', () => {
    expect(toShelfScanError(new TypeError('boom'))).toMatchObject({
      kind: 'failed',
      message: "Couldn't read this photo. Try again.",
    });
    expect(toShelfScanError('string')).toMatchObject({ kind: 'failed' });
  });
});

describe('shelf selection', () => {
  const items: ShelfScanItem[] = [
    {
      reading: { kind: 'manga', title: 'Vagabond', count: 8 },
      sure: true,
      candidates: [
        { item: item('a', 'Vagabond, Vol. 1'), owned: false },
        { item: item('b', 'Vagabond VIZBIG Edition, Vol. 1'), owned: true },
      ],
    },
    {
      reading: { kind: 'manga', title: 'Demon Slayer', count: 23 },
      sure: true,
      candidates: [{ item: item('c', 'Demon Slayer, Vol. 1'), owned: true }],
    },
    { reading: { kind: 'comic', title: 'UNLAND SAGA', count: 1 }, sure: true, candidates: [] },
    {
      reading: { kind: 'manga', title: 'VAGABOND', count: 1 },
      sure: true,
      candidates: [{ item: item('a', 'Vagabond, Vol. 1'), owned: false }],
    },
    {
      reading: { kind: 'manga', title: 'Black Clover', count: 1 },
      sure: false,
      candidates: [{ item: item('d', 'Black Clover, Vol. 1'), owned: false }],
    },
  ];

  it('starts with each sure best match ticked, except owned ones and items with no match', () => {
    expect(initialChoices(items).map((choice) => choice.checked)).toEqual([
      true,
      false,
      false,
      true,
      false, // less sure
    ]);
  });

  it('lists sure items first', () => {
    const mixed = [items[4]!, items[0]!, items[2]!];
    expect(reviewOrder(mixed)).toEqual([1, 2, 0]);
  });

  it('adds what is ticked, once each', () => {
    const entries = chosenEntries(items, initialChoices(items));

    expect(entries.map((entry) => entry.catalogId)).toEqual(['a']);
    expect(entries[0]).toMatchObject({ title: 'Vagabond, Vol. 1', category: 'manga' });
  });

  it('unticks, and switches to another match (unticked if owned)', () => {
    let choices = toggleChoice(initialChoices(items), 0);
    expect(chosenEntries(items, choices).map((entry) => entry.catalogId)).toEqual(['a']); // from item 4

    choices = chooseCandidate(items, choices, 0, 1);
    expect(choices[0]).toEqual({ candidate: 1, checked: false });
    choices = chooseCandidate(items, choices, 0, 0);
    expect(choices[0]).toEqual({ candidate: 0, checked: true });
  });
});
