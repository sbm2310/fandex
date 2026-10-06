import { z } from 'zod';

/**
 * What a catalog entry tells us about the fiction it belongs to: the input to universe
 * matching. Catalog adapters attach it to entries; the API stores it with each catalog item
 * (it isn't sent to the apps). Everything except the title is optional.
 */
export type MatchSignals = {
  title: string;
  /** Series names, e.g. "Harry Potter" or "The Thrawn Trilogy". */
  series?: readonly string[];
  /** Authors: never mistaken for characters (one Star Wars novel lists its author as one). */
  authors?: readonly string[];
  /** Characters named by the source (Open Library's `person`). */
  people?: readonly string[];
  /** Places named by the source (Open Library's `place`). */
  places?: readonly string[];
  subjects?: readonly string[];
  /** A LEGO set's theme id followed by its parent theme ids. */
  legoThemeIds?: readonly number[];
  /**
   * A LEGO set's minifig names as Rebrickable lists them. Absent means "not fetched yet"
   * (search results skip them); an empty list means the set has none.
   */
  minifigs?: readonly string[];
};

const strings = z.array(z.string()).readonly();

/** Validates signals read back from storage (a JSON column is just `unknown` to TypeScript). */
export const matchSignalsSchema = z.object({
  title: z.string(),
  series: strings.exactOptional(),
  authors: strings.exactOptional(),
  people: strings.exactOptional(),
  places: strings.exactOptional(),
  subjects: strings.exactOptional(),
  legoThemeIds: z.array(z.number().int()).readonly().exactOptional(),
  minifigs: strings.exactOptional(),
}) satisfies z.ZodType<MatchSignals>;
