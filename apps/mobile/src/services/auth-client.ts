import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** The Better Auth client for the Fandex API. Created once, in default-services.ts. */
export function createAuthClientFor(apiUrl: string) {
  return createAuthClient({
    baseURL: apiUrl,
    // iOS/Android: the session cookie lives in the Keychain/Keystore (expo-secure-store) and
    // is attached to requests by the plugin. Web: the browser keeps it; cross-origin requests
    // need credentials included.
    plugins: [expoClient({ scheme: 'fandex', storagePrefix: 'fandex', storage: SecureStore })],
    ...(Platform.OS === 'web' && { fetchOptions: { credentials: 'include' as const } }),
  });
}

export type FandexAuthClient = ReturnType<typeof createAuthClientFor>;
