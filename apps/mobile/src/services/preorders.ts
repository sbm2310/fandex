import {
  collectionItemSchema,
  preorderSchema,
  preordersResponseSchema,
  type CollectionItemResponse,
  type CreatePreorderRequest,
  type PreorderResponse,
  type UpdatePreorderRequest,
} from '@fandex/core';

import type { ApiFetch } from './api-fetch';

/** Pre-orders on the Fandex API (signed in only). Screens use the hooks in `use-preorders`. */
export type Preorders = {
  list(): Promise<PreorderResponse[]>;
  create(request: CreatePreorderRequest): Promise<PreorderResponse>;
  update(id: string, changes: UpdatePreorderRequest): Promise<PreorderResponse>;
  /** Closes it and puts the item in the collection; returns both. */
  arrive(id: string): Promise<{ preorder: PreorderResponse; item: CollectionItemResponse }>;
  remove(id: string): Promise<void>;
};

export class PreorderError extends Error {
  override readonly name = 'PreorderError';

  constructor(
    message: string,
    /** The server's explanation ("What's paid can't be more than the price"), when it gave one. */
    readonly detail?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class ApiPreorders implements Preorders {
  constructor(private readonly apiFetch: ApiFetch) {}

  async list(): Promise<PreorderResponse[]> {
    const response = await this.request('/preorders');
    return preordersResponseSchema.parse(await response.json()).preorders;
  }

  async create(request: CreatePreorderRequest): Promise<PreorderResponse> {
    const response = await this.request('/preorders', this.json('POST', request));
    return preorderSchema.parse(await response.json());
  }

  async update(id: string, changes: UpdatePreorderRequest): Promise<PreorderResponse> {
    const response = await this.request(
      `/preorders/${encodeURIComponent(id)}`,
      this.json('PATCH', changes),
    );
    return preorderSchema.parse(await response.json());
  }

  async arrive(id: string) {
    const response = await this.request(`/preorders/${encodeURIComponent(id)}/arrive`, {
      method: 'POST',
    });
    const body = (await response.json()) as { preorder: unknown; item: unknown };
    return {
      preorder: preorderSchema.parse(body.preorder),
      item: collectionItemSchema.parse(body.item),
    };
  }

  async remove(id: string): Promise<void> {
    await this.request(`/preorders/${encodeURIComponent(id)}`, { method: 'DELETE' }, [404]);
  }

  private json(method: string, body: unknown): RequestInit {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }

  private async request(path: string, init: RequestInit = {}, acceptable: number[] = []) {
    let response: Response;
    try {
      response = await this.apiFetch(path, init);
    } catch (error) {
      throw new PreorderError("Can't reach the Fandex server", undefined, { cause: error });
    }
    if (!response.ok && !acceptable.includes(response.status)) {
      const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
      const detail = typeof body?.message === 'string' ? body.message : undefined;
      throw new PreorderError(`Pre-order request failed (${response.status})`, detail);
    }
    return response;
  }
}
