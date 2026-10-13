import { z } from 'zod';

import { figureSeedEntrySchema, type FigureSeedEntry } from './figure-seed-entry';
import hotToysDc from './seed/hot-toys-dc.json';
import hotToysMarvel from './seed/hot-toys-marvel.json';
import hotToysStarWars from './seed/hot-toys-star-wars.json';
import inart from './seed/inart.json';

/**
 * Fandex's curated figure list: every InArt figure, and a starter set of well-known Hot Toys
 * figures for Star Wars, Marvel and DC. Its own entry point (`@fandex/core/figure-seed`), so
 * the app never bundles it; the API syncs it into the catalog.
 */
export const FIGURE_SEED: readonly FigureSeedEntry[] = z
  .array(figureSeedEntrySchema)
  .parse([...inart, ...hotToysStarWars, ...hotToysMarvel, ...hotToysDc]);
