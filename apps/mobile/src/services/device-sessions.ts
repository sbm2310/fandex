import { deviceSessionsResponseSchema, type DeviceSession } from '@fandex/core';

import type { ApiFetch } from './api-fetch';

/** The devices the user is signed in on (signed in only). Screens use `hooks/use-devices`. */
export type DeviceSessions = {
  list(): Promise<DeviceSession[]>;
  /** Signs out one of the user's other devices. */
  signOut(id: string): Promise<void>;
  /** Signs out every device but this one; resolves with how many were signed out. */
  signOutOthers(): Promise<number>;
};

export class ApiDeviceSessions implements DeviceSessions {
  constructor(private readonly apiFetch: ApiFetch) {}

  async list(): Promise<DeviceSession[]> {
    const response = await this.request('/sessions');
    return deviceSessionsResponseSchema.parse(await response.json());
  }

  async signOut(id: string): Promise<void> {
    await this.request(`/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async signOutOthers(): Promise<number> {
    const response = await this.request('/sessions/sign-out-others', { method: 'POST' });
    const body = (await response.json()) as { signedOut?: unknown };
    return typeof body.signedOut === 'number' ? body.signedOut : 0;
  }

  private async request(path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await this.apiFetch(path, init);
    } catch (error) {
      throw new Error("Can't reach the Fandex server.", { cause: error });
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
      throw new Error(
        typeof body?.message === 'string' ? body.message : 'Something went wrong. Try again.',
      );
    }
    return response;
  }
}
