/**
 * A colour per universe, by its seed slug. Presentation only, so it lives in the app rather than in
 * core's universe seed. Screens read it through `useUniverseColors(slug)`.
 */

import { Colors } from './theme';

export type UniverseColors = {
  /** Header and card background. */
  ground: string;
  /** Bars, stripes, avatar rings and large numbers: ≥ 3:1 on `ground`, not meant for body text. */
  accent: string;
  /** Text on `ground`. */
  onGround: string;
  /** Tiles and buttons sitting on `ground`: a little darker (dark mode) or lighter (light). */
  raised: string;
};

type Scheme = keyof typeof Colors;

export const UniverseColorTable: Record<string, Record<Scheme, Omit<UniverseColors, 'raised'>>> = {
  'middle-earth': {
    dark: { ground: '#2B3A23', accent: '#9CC47F', onGround: '#F4F0EA' },
    light: { ground: '#E3ECD9', accent: '#4F7A35', onGround: '#1A1720' },
  },
  'star-wars': {
    dark: { ground: '#2A2614', accent: '#FFE81F', onGround: '#F4F0EA' },
    light: { ground: '#F6EDB3', accent: '#8A7300', onGround: '#1A1720' },
  },
  'wizarding-world': {
    dark: { ground: '#3A1D24', accent: '#E05A6A', onGround: '#F4F0EA' },
    light: { ground: '#F2DDE0', accent: '#9E2B3C', onGround: '#1A1720' },
  },
  dc: {
    dark: { ground: '#16263F', accent: '#5B8FE8', onGround: '#F4F0EA' },
    light: { ground: '#DDE6F5', accent: '#2F5DB8', onGround: '#1A1720' },
  },
  marvel: {
    dark: { ground: '#3A1616', accent: '#FF6B5B', onGround: '#F4F0EA' },
    light: { ground: '#F6DCD8', accent: '#C2362A', onGround: '#1A1720' },
  },
  'a-song-of-ice-and-fire': {
    dark: { ground: '#1B2830', accent: '#8FC7DB', onGround: '#F4F0EA' },
    light: { ground: '#DCEAF0', accent: '#2D6A82', onGround: '#1A1720' },
  },
  cosmere: {
    dark: { ground: '#33241A', accent: '#E39A5B', onGround: '#F4F0EA' },
    light: { ground: '#F5E3D3', accent: '#9A5420', onGround: '#1A1720' },
  },
  'one-piece': {
    dark: { ground: '#10302F', accent: '#FF7A6B', onGround: '#F4F0EA' },
    light: { ground: '#D9F0EE', accent: '#B23A2E', onGround: '#1A1720' },
  },
  pokemon: {
    dark: { ground: '#1A2547', accent: '#FFD23F', onGround: '#F4F0EA' },
    light: { ground: '#E3E9F8', accent: '#2F4BA0', onGround: '#1A1720' },
  },
  'jurassic-park': {
    dark: { ground: '#2A1E14', accent: '#F2B233', onGround: '#F4F0EA' },
    light: { ground: '#F3E6D0', accent: '#8A5A00', onGround: '#1A1720' },
  },
  'disney-pixar': {
    dark: { ground: '#3A1630', accent: '#FF7AC6', onGround: '#F4F0EA' },
    light: { ground: '#F7DDEC', accent: '#A3246F', onGround: '#1A1720' },
  },
};

/** The colours for a universe in a colour scheme; a neutral surface and violet when unknown. */
export function universeColors(slug: string | undefined, scheme: Scheme): UniverseColors {
  const raised = scheme === 'dark' ? 'rgba(0, 0, 0, 0.22)' : 'rgba(255, 255, 255, 0.6)';
  const known = slug === undefined ? undefined : UniverseColorTable[slug];
  if (known) return { ...known[scheme], raised };
  const colors = Colors[scheme];
  return { ground: colors.backgroundElement, accent: colors.accent, onGround: colors.text, raised };
}
