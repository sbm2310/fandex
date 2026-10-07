import {
  aiQuotaResponseSchema,
  shelfScanResponseSchema,
  type AiQuotaResponse,
  type ShelfScanResponse,
} from '@fandex/core';

import type { ApiFetch } from './api-fetch';
import { appendJpeg } from './form-image';
import { prepareShelfImages, type ShelfPhoto } from './shelf-photo';

export type { ShelfPhoto } from './shelf-photo';

/** Shelf scanning on the Fandex API (signed in only). Screens get it via `useShelfScanner()`. */
export type ShelfScanner = {
  /** Whether scanning is set up on the server, and today's allowance. */
  quota(): Promise<AiQuotaResponse>;
  scan(photo: ShelfPhoto): Promise<ShelfScanResponse>;
};

export type ShelfScanErrorKind =
  /** Today's scans are used up (429). */
  | 'quota'
  /** The AI or the server is busy, or everyone's daily limit is reached (503). */
  | 'busy'
  /** Not signed in (401). */
  | 'signed-out'
  | 'network'
  | 'failed';

export class ShelfScanError extends Error {
  constructor(
    readonly kind: ShelfScanErrorKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ShelfScanError';
  }
}

const KINDS: readonly ShelfScanErrorKind[] = ['quota', 'busy', 'signed-out', 'network', 'failed'];

/**
 * Any error from a scan as a ShelfScanError the screen can explain. Checked by shape, not
 * `instanceof`: classes extending Error don't survive every build's transpilation (on the web
 * build `instanceof` failed and the screen showed nothing), and an unexpected error must still
 * show a message.
 */
export function toShelfScanError(error: unknown): ShelfScanError {
  if (
    error instanceof Error &&
    KINDS.includes((error as Partial<ShelfScanError>).kind as ShelfScanErrorKind)
  ) {
    return error as ShelfScanError;
  }
  return new ShelfScanError('failed', "Couldn't read this photo. Try again.", { cause: error });
}

/** The server's own message ("You've used today's 5 shelf scans…") when it sent one. */
async function serverMessage(response: Response): Promise<string | undefined> {
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
  return typeof body?.message === 'string' ? body.message : undefined;
}

async function failure(response: Response): Promise<ShelfScanError> {
  const message = await serverMessage(response);
  switch (response.status) {
    case 401:
      return new ShelfScanError('signed-out', 'Sign in to scan a shelf.');
    case 429:
      return new ShelfScanError('quota', message ?? "You've used today's shelf scans.");
    case 503:
      return new ShelfScanError('busy', message ?? 'Shelf scanning is busy. Try again shortly.');
    default:
      return new ShelfScanError('failed', "Couldn't read this photo. Try again.");
  }
}

export class ApiShelfScanner implements ShelfScanner {
  constructor(private readonly apiFetch: ApiFetch) {}

  async quota(): Promise<AiQuotaResponse> {
    const response = await this.request('/ai/quota');
    if (!response.ok) throw await failure(response);
    return aiQuotaResponseSchema.parse(await response.json());
  }

  async scan(photo: ShelfPhoto): Promise<ShelfScanResponse> {
    // Cut into two halves on the device (the model reads a shelf far better in parts) and
    // send them as one multipart request; the photo itself never leaves the phone whole.
    const images = await prepareShelfImages(photo);
    const form = new FormData();
    for (const [index, image] of images.entries()) {
      await appendJpeg(form, 'images', image, `shelf-${index + 1}.jpg`);
    }
    const response = await this.request('/ai/shelf-scans', { method: 'POST', body: form });
    if (!response.ok) throw await failure(response);
    return shelfScanResponseSchema.parse(await response.json());
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    try {
      return await this.apiFetch(path, init);
    } catch (error) {
      throw new ShelfScanError('network', "Couldn't reach Fandex. Check your connection.", {
        cause: error,
      });
    }
  }
}
