import { z } from 'zod';

import { RELEASE_PRECISIONS, releaseDate } from '../preorders/release-date';

/** An expected release; any day in the period is accepted and normalized to its first day. */
export const releaseDateSchema = z
  .object({ date: z.iso.date(), precision: z.enum(RELEASE_PRECISIONS) })
  .transform(({ date, precision }) => releaseDate(date, precision));
