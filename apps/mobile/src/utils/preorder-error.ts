/**
 * What to tell the user when saving a pre-order failed. Read by shape, not `instanceof`
 * (custom Error subclasses don't survive the web build: see CLAUDE.md).
 */
export function preorderErrorMessage(error: unknown): string {
  const { detail, message } = (error ?? {}) as { detail?: unknown; message?: unknown };
  if (typeof detail === 'string') return detail;
  if (typeof message === 'string' && message.startsWith("Can't reach")) {
    return "Couldn't reach Fandex. Check your connection and try again.";
  }
  return "Couldn't save the pre-order. Try again.";
}
