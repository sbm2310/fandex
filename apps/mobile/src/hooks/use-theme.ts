/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** The colour scheme in use: the phone's setting, light when it has none. */
export function useThemeScheme(): keyof typeof Colors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  return Colors[useThemeScheme()];
}
