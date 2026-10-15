/**
 * Design tokens for Fandex ("the collector's vitrine", docs/plans/redesign.md): colors (light +
 * dark), fonts and spacing.
 * Components read colors through `useTheme()` rather than importing `Colors` directly.
 */

// One import per weight, so only these font files are bundled (the packages' index files
// require every weight).
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1A1720',
    background: '#F7F4EF',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EFEBE4',
    textSecondary: '#6A6370',
    border: '#DDD6CC',
    accent: '#5B4BDB',
    onAccent: '#FFFFFF',
    /** Amounts owed, due dates and "needs attention" (text and bars). */
    money: '#8A5A00',
    /** The ground of a "needs attention" card. */
    moneyGround: '#FBEFD9',
    danger: '#B3261E',
  },
  dark: {
    text: '#F4F0EA',
    background: '#121014',
    backgroundElement: '#1E1C22',
    backgroundSelected: '#26242B',
    textSecondary: '#A8A1AE',
    border: '#312E36',
    accent: '#B7AAFF',
    onAccent: '#17112E',
    money: '#F0B44C',
    moneyGround: '#2A2113',
    danger: '#FF8A80',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Font families, one per weight: React Native picks a custom font by family name, so a weight is
 * a different family (never combine these with `fontWeight`, which makes Android fall back to the
 * system font). The fonts are loaded by the root layout (`FontFiles`).
 */
export const Fonts = {
  /** Bricolage Grotesque: screen titles, section headings and big numbers. */
  display: 'BricolageGrotesque_800ExtraBold',
  /** Figtree: everything else. */
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semiBold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  mono: Platform.select({ ios: 'ui-monospace', web: 'var(--font-mono)', default: 'monospace' }),
} as const;

/** The font files behind `Fonts`, keyed by family name (for `useFonts`). */
export const FontFiles = {
  [Fonts.display]: BricolageGrotesque_800ExtraBold,
  [Fonts.regular]: Figtree_400Regular,
  [Fonts.medium]: Figtree_500Medium,
  [Fonts.semiBold]: Figtree_600SemiBold,
  [Fonts.bold]: Figtree_700Bold,
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
