import { UNIVERSE_SEED } from '@fandex/core';

import { Colors } from '@/constants/theme';
import { UniverseColorTable, universeColors } from '@/constants/universe-colors';

describe('universe colours', () => {
  it('only colours universes the seed knows (a typo would silently fall back)', () => {
    const slugs = UNIVERSE_SEED.map((universe) => universe.slug);
    expect(slugs).toEqual(expect.arrayContaining(Object.keys(UniverseColorTable)));
  });

  it('gives each scheme its own colours', () => {
    expect(universeColors('star-wars', 'dark').accent).toBe('#FFE81F');
    expect(universeColors('star-wars', 'light').accent).toBe('#8A7300');
  });

  it('falls back to a neutral surface and violet', () => {
    expect(universeColors('discworld', 'dark')).toEqual({
      ground: Colors.dark.backgroundElement,
      accent: Colors.dark.accent,
      onGround: Colors.dark.text,
      raised: 'rgba(0, 0, 0, 0.22)',
    });
    expect(universeColors(undefined, 'light').accent).toBe(Colors.light.accent);
  });
});
