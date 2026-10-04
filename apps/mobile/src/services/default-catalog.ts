import { OpenLibraryCatalog, type BookCatalog } from '@fandex/core';
import { Platform } from 'react-native';

/**
 * Open Library allows 3 requests/second (instead of 1) for apps that identify themselves.
 * Browsers don't allow setting User-Agent, so only native builds send it.
 */
const USER_AGENT = 'Fandex/0.1 (https://github.com/sbm2310/fandex)';

export function createDefaultCatalog(): BookCatalog {
  return new OpenLibraryCatalog(
    Platform.OS === 'web' ? {} : { headers: { 'User-Agent': USER_AGENT } },
  );
}
