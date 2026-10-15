import { figureScanResponseSchema, type FigureScanResponse } from '@fandex/core';

import type { ApiFetch } from './api-fetch';
import { appendJpeg } from './form-image';
import { prepareBoxImage, type ShelfPhoto } from './shelf-photo';
import { failure, ShelfScanError } from './shelf-scanner';

/**
 * Figure box scanning on the Fandex API (signed in only): one photo of a box, read by AI and
 * matched to the shared figure catalog. Its allowance comes with the shelf scanner's `quota()`.
 * Errors are `ShelfScanError`s, so the screens explain them the same way.
 */
export type FigureScanner = {
  scan(photo: ShelfPhoto): Promise<FigureScanResponse>;
};

export class ApiFigureScanner implements FigureScanner {
  constructor(private readonly apiFetch: ApiFetch) {}

  async scan(photo: ShelfPhoto): Promise<FigureScanResponse> {
    const form = new FormData();
    await appendJpeg(form, 'images', await prepareBoxImage(photo), 'box.jpg');
    let response: Response;
    try {
      response = await this.apiFetch('/ai/figure-scans', { method: 'POST', body: form });
    } catch (error) {
      throw new ShelfScanError('network', "Couldn't reach Fandex. Check your connection.", {
        cause: error,
      });
    }
    if (!response.ok) {
      throw await failure(response, {
        signIn: 'Sign in to scan a box.',
        usedUp: "You've used today's box scans.",
        busy: 'Box scanning is busy. Try again shortly.',
      });
    }
    return figureScanResponseSchema.parse(await response.json());
  }
}
