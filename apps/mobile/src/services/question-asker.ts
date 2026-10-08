import { askResponseSchema, type AskResponse } from '@fandex/core';

import type { ApiFetch } from './api-fetch';

/** "Ask your collection" on the Fandex API (signed in only). Screens use `useAsk()`. */
export type QuestionAsker = {
  ask(question: string): Promise<AskResponse>;
};

/**
 * Thrown when the API couldn't answer (offline, signed out, server error). The app then
 * answers on the device with keyword matching, so a question always gets an answer.
 */
export class AskUnavailableError extends Error {
  override readonly name = 'AskUnavailableError';
}

export class ApiQuestionAsker implements QuestionAsker {
  constructor(private readonly apiFetch: ApiFetch) {}

  async ask(question: string): Promise<AskResponse> {
    const response = await this.apiFetch('/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }).catch((error: unknown) => {
      throw new AskUnavailableError("Couldn't reach Fandex", { cause: error });
    });
    if (!response.ok) throw new AskUnavailableError(`Fandex answered ${response.status}`);
    return askResponseSchema.parse(await response.json());
  }
}
