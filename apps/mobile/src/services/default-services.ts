import { KeyValueCollectionRepository } from '@fandex/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import { ApiCatalog } from './api-catalog';
import { ApiCollectionRepository } from './api-collection-repository';
import { ApiLegoCatalog } from './api-lego-catalog';
import { createApiFetch } from './api-fetch';
import { getApiUrl } from './api-url';
import type { AppServices } from './app-services';
import { createAuthClientFor } from './auth-client';
import { BetterAuthAccountService } from './better-auth-account-service';

export function createDefaultServices(): AppServices {
  const apiUrl = getApiUrl();
  const authClient = createAuthClientFor(apiUrl);
  const apiFetch = createApiFetch(apiUrl, () => authClient.getCookie());
  return {
    // Search and ISBN lookups go through the Fandex API (cached, categorized, rate-limited).
    catalog: new ApiCatalog(apiFetch),
    // LEGO sets via the API (Rebrickable behind it).
    legoCatalog: new ApiLegoCatalog(apiFetch),
    // AsyncStorage persists on the device (localStorage on web): the guest collection.
    deviceCollection: new KeyValueCollectionRepository({
      store: AsyncStorage,
      generateId: randomUUID,
    }),
    accountCollection: new ApiCollectionRepository(apiFetch),
    account: new BetterAuthAccountService(authClient),
  };
}
