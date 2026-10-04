import type { ConfirmOptions } from './confirm';

export type { ConfirmOptions } from './confirm';

/** Web version: React Native's Alert is a no-op in browsers, so use the built-in dialog. */
export function confirm({ title, message }: ConfirmOptions): Promise<boolean> {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}
