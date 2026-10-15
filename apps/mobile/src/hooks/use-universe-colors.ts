import { universeColors, type UniverseColors } from '@/constants/universe-colors';
import { useThemeScheme } from '@/hooks/use-theme';

/** A universe's colours in the current colour scheme (neutral for an unknown slug). */
export function useUniverseColors(slug: string | undefined): UniverseColors {
  return universeColors(slug, useThemeScheme());
}
