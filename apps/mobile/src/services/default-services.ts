import { KeyValueCollectionRepository, OpenLibraryCatalog } from '@fandex/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';

import { getApiUrl } from './api-url';
import type { AppServices } from './app-services';
import { createAuthClientFor } from './auth-client';
import { BetterAuthAccountService } from './better-auth-account-service';

/**
 * Open Library allows 3 requests/second (instead of 1) for apps that identify themselves.
 * Browsers don't allow setting User-Agent, so only native builds send it.
 */
const USER_AGENT = 'Fandex/0.1 (https://github.com/sbm2310/fandex)';

export function createDefaultServices(): AppServices {
  const apiUrl = getApiUrl();
  const authClient = createAuthClientFor(apiUrl);
  return {
    catalog: new OpenLibraryCatalog(
      Platform.OS === 'web' ? {} : { headers: { 'User-Agent': USER_AGENT } },
    ),
    // AsyncStorage persists on the device (localStorage on web). Stage 2 swaps in the API.
    collection: new KeyValueCollectionRepository({ store: AsyncStorage, generateId: randomUUID }),
    account: new BetterAuthAccountService(authClient),
  };
}
