import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 3000;

type ApiUrlInputs = {
  /** EXPO_PUBLIC_API_URL, if set: always wins (production builds, custom setups). */
  configuredUrl?: string | undefined;
  platform: string;
  /** Expo's dev server address as the phone sees it, e.g. "192.168.1.20:8081". */
  devServerHost?: string | undefined;
  /** The web page's location, on web. */
  webLocation?: { protocol: string; hostname: string; origin: string } | undefined;
  /** True in development builds (Expo's __DEV__). */
  isDevelopment: boolean;
};

/**
 * Where the Fandex API lives (its origin; routes are under /api).
 * - EXPO_PUBLIC_API_URL wins when set (e.g. Expo Go pointed at the deployed API).
 * - Web in production: the API serves the web app, so it's the page's own origin (same
 *   origin keeps the session cookie first-party).
 * - Web in development: the API runs next to Expo's dev server on port 3000.
 * - Native in development: `localhost` on an iPhone is the phone itself, so use the Mac's
 *   address from Expo's dev server.
 */
export function resolveApiUrl({
  configuredUrl,
  platform,
  devServerHost,
  webLocation,
  isDevelopment,
}: ApiUrlInputs): string {
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');
  if (platform === 'web' && webLocation) {
    return isDevelopment
      ? `${webLocation.protocol}//${webLocation.hostname}:${API_PORT}`
      : webLocation.origin;
  }
  const host = devServerHost?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;
  return `http://localhost:${API_PORT}`;
}

export function getApiUrl(): string {
  return resolveApiUrl({
    // Inlined at build time by Expo; must be referenced literally.
    configuredUrl: process.env.EXPO_PUBLIC_API_URL,
    platform: Platform.OS,
    devServerHost: Constants.expoConfig?.hostUri,
    webLocation: typeof window !== 'undefined' ? window.location : undefined,
    isDevelopment: __DEV__,
  });
}
