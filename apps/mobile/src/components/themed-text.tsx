import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'subtitle'
    | 'section'
    | 'small'
    | 'smallBold'
    | 'overline'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

/**
 * Text in the app's type scale. Each type picks a font family per weight (see `Fonts`), so style
 * overrides should change `fontFamily`, not `fontWeight`.
 */
export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const color = theme[themeColor ?? (type === 'linkPrimary' ? 'accent' : 'text')];

  return <Text style={[{ color }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  /** Body text. */
  default: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  /** Display: barely used; screens use `subtitle` for their titles. */
  title: {
    fontFamily: Fonts.display,
    fontSize: 48,
    lineHeight: 52,
  },
  /** Display: screen titles. */
  subtitle: {
    fontFamily: Fonts.display,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  /** Section headings. */
  section: {
    fontFamily: Fonts.display,
    fontSize: 21,
    lineHeight: 26,
  },
  /** Meta text. */
  small: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  /** Item titles and button labels. */
  smallBold: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  /** "NEEDS ATTENTION": small capitals above a section. */
  overline: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  link: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    lineHeight: 30,
  },
  linkPrimary: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    lineHeight: 30,
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
});
