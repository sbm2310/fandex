import {
  adminFigureSuggestionsResponseSchema,
  figureSuggestionSchema,
  meResponseSchema,
  type AdminFigureSuggestion,
  type FigureSuggestionResponse,
} from '@fandex/core';

import type { ApiFetch } from './api-fetch';

/**
 * Reviewing figure suggestions (admins only, listed in the server's ADMIN_EMAILS). Screens use
 * the hooks in `use-admin`.
 */
export type AdminReviews = {
  /** Whether the signed-in user may review: asked of the server (`GET /me`). */
  isAdmin(): Promise<boolean>;
  pending(): Promise<AdminFigureSuggestion[]>;
  approve(id: string): Promise<FigureSuggestionResponse>;
  merge(id: string, targetId: string): Promise<FigureSuggestionResponse>;
  reject(id: string, note: string): Promise<FigureSuggestionResponse>;
};

export class AdminReviewError extends Error {
  override readonly name = 'AdminReviewError';

  constructor(
    message: string,
    /** The server's explanation ("This suggestion was already reviewed"), when it gave one. */
    readonly detail?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class ApiAdminReviews implements AdminReviews {
  constructor(private readonly apiFetch: ApiFetch) {}

  async isAdmin(): Promise<boolean> {
    const response = await this.request('/me');
    return meResponseSchema.parse(await response.json()).isAdmin;
  }

  async pending(): Promise<AdminFigureSuggestion[]> {
    const response = await this.request('/admin/figure-suggestions');
    return adminFigureSuggestionsResponseSchema.parse(await response.json()).suggestions;
  }

  approve(id: string) {
    return this.decide(id, 'approve');
  }

  merge(id: string, targetId: string) {
    return this.decide(id, 'merge', { targetId });
  }

  reject(id: string, note: string) {
    return this.decide(id, 'reject', { note });
  }

  private async decide(id: string, action: string, body: object = {}) {
    const response = await this.request(
      `/admin/figure-suggestions/${encodeURIComponent(id)}/${action}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    return figureSuggestionSchema.parse(await response.json());
  }

  private async request(path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await this.apiFetch(path, init);
    } catch (error) {
      throw new AdminReviewError("Can't reach the Fandex server", undefined, { cause: error });
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
      const detail = typeof body?.message === 'string' ? body.message : undefined;
      throw new AdminReviewError(`Admin request failed (${response.status})`, detail);
    }
    return response;
  }
}
