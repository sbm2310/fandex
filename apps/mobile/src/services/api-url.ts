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
  webLocation?: { protocol: string; hostname: string } | undefined;
};

/**
 * Where the Fandex API lives. In development, `localhost` on an iPhone is the phone itself,
 * so native builds use the Mac's address from Expo's dev server instead.
 */
export function resolveApiUrl({
  configuredUrl,
  platform,
  devServerHost,
  webLocation,
}: ApiUrlInputs): string {
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');
  if (platform === 'web' && webLocation) {
    return `${webLocation.protocol}//${webLocation.hostname}:${API_PORT}`;
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
  });
}
