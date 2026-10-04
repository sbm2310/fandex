import { CatalogError } from '@fandex/core';

/** A short, user-facing explanation of why a catalog request failed. */
export function catalogErrorMessage(error: unknown): string {
  if (error instanceof CatalogError) {
    switch (error.kind) {
      case 'network':
        return "Can't reach the book catalog. Check your connection and try again.";
      case 'rate-limited':
        return 'Too many searches in a row. Wait a few seconds and try again.';
      case 'http':
      case 'invalid-response':
        return 'The book catalog is having trouble right now. Try again in a moment.';
    }
  }
  return 'Something went wrong while searching. Try again.';
}
