import {
  figureSuggestionSchema,
  figureSuggestionsResponseSchema,
  type FigureSuggestionResponse,
} from '@fandex/core';

import type { ApiFetch } from './api-fetch';

/**
 * Suggesting your own figures for Fandex's shared catalog (signed in only), and what became of
 * the suggestions. Screens use the hooks in `use-figure-suggestions`.
 */
export type FigureSuggestions = {
  suggest(catalogItemId: string, note?: string): Promise<FigureSuggestionResponse>;
  mine(): Promise<FigureSuggestionResponse[]>;
};

export class FigureSuggestionError extends Error {
  override readonly name = 'FigureSuggestionError';
}

export class ApiFigureSuggestions implements FigureSuggestions {
  constructor(private readonly apiFetch: ApiFetch) {}

  async suggest(catalogItemId: string, note?: string): Promise<FigureSuggestionResponse> {
    const response = await this.request('/figure-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalogItemId, ...(note && { note }) }),
    });
    return figureSuggestionSchema.parse(await response.json());
  }

  async mine(): Promise<FigureSuggestionResponse[]> {
    const response = await this.request('/figure-suggestions');
    return figureSuggestionsResponseSchema.parse(await response.json()).suggestions;
  }

  private async request(path: string, init: RequestInit = {}) {
    const response = await this.apiFetch(path, init).catch((error: unknown) => {
      throw new FigureSuggestionError("Can't reach the Fandex server", { cause: error });
    });
    if (!response.ok) {
      throw new FigureSuggestionError(`Suggestion request failed (${response.status})`);
    }
    return response;
  }
}
