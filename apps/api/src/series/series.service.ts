import {
  bookSeriesSchema,
  CatalogError,
  type BookSeries,
  type SeriesEntry,
  type WorkSeriesResponse,
} from '@fandex/core';
import { Inject, Injectable, Logger } from '@nestjs/common';

import type { Prisma, Series } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** What the service needs from Wikidata (WikidataSeriesCatalog, spaced; a fake in tests). */
export interface SeriesSource {
  seriesForWork(workKey: string, options?: { signal?: AbortSignal }): Promise<BookSeries | null>;
}

/** Injection token for the series source. */
export const SERIES_SOURCE = Symbol('SERIES_SOURCE');

/** A work's series is asked again after this long (books join series slowly). */
const CHECK_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
/** Per request, Wikidata is asked for at most this long; the rest come next time. */
const ASK_BUDGET_MS = 8000;

/**
 * Book series for Open Library works, cached from Wikidata. Answers from the database; asks
 * Wikidata only about works it doesn't know or hasn't checked for a month, one at a time
 * within a time budget. A fetched series records all its works, so owning several books of
 * one series costs one query. When Wikidata fails, what's cached is answered.
 */
@Injectable()
export class SeriesService {
  private readonly logger = new Logger(SeriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SERIES_SOURCE) private readonly source: SeriesSource,
  ) {}

  async forWorks(workKeys: readonly string[], now = new Date()): Promise<WorkSeriesResponse> {
    const keys = [...new Set(workKeys)];
    const known = await this.prisma.workSeries.findMany({ where: { workKey: { in: keys } } });
    const checked = new Map(known.map((row) => [row.workKey, row]));
    const due = keys.filter((key) => {
      const row = checked.get(key);
      return !row || now.getTime() - row.checkedAt.getTime() > CHECK_INTERVAL_MS;
    });

    const answered = new Map<string, string | null>(
      known.map((row) => [row.workKey, row.seriesWikidataId]),
    );
    // Works a series fetched in this request already covers (several owned books of one series).
    const covered = new Set<string>();
    const signal = AbortSignal.timeout(ASK_BUDGET_MS);
    for (const key of due) {
      if (signal.aborted) break;
      if (covered.has(key)) continue;
      try {
        const series = await this.source.seriesForWork(key, { signal });
        const seriesId = await this.store(key, series, now);
        answered.set(key, seriesId);
        covered.add(key);
        for (const entry of series ? [...series.entries, ...series.extras] : []) {
          if (!entry.workKey) continue;
          answered.set(entry.workKey, seriesId);
          covered.add(entry.workKey);
        }
      } catch (error) {
        if (signal.aborted) break;
        this.logger.warn(`Could not ask Wikidata about ${key}: ${String(error)}`);
        // Rate-limited: don't keep asking in this request.
        if (error instanceof CatalogError && error.kind === 'rate-limited') break;
      }
    }

    const left = due.filter((key) => !answered.has(key) && !covered.has(key)).length;
    if (signal.aborted && left > 0) {
      this.logger.warn(`Wikidata was slow: ${left} work(s) left for the next request`);
    }

    const seriesIds = [...new Set([...answered.values()].filter((id): id is string => !!id))];
    const rows = await this.prisma.series.findMany({ where: { wikidataId: { in: seriesIds } } });
    const series = rows.flatMap((row) => toBookSeries(row) ?? []);
    const valid = new Set(series.map((s) => s.wikidataId));
    return {
      works: keys.map((workKey) => {
        const id = answered.get(workKey) ?? null;
        return { workKey, seriesId: id && valid.has(id) ? id : null };
      }),
      series,
    };
  }

  /** Saves what Wikidata said about a work (and the series' other works); returns the series id. */
  private async store(
    workKey: string,
    series: BookSeries | null,
    now: Date,
  ): Promise<string | null> {
    if (!series) {
      await this.prisma.workSeries.upsert({
        where: { workKey },
        create: { workKey, seriesWikidataId: null, checkedAt: now },
        update: { seriesWikidataId: null, checkedAt: now },
      });
      return null;
    }
    const data = {
      name: series.name,
      entries: series.entries as unknown as Prisma.InputJsonArray,
      extras: series.extras as unknown as Prisma.InputJsonArray,
      fetchedAt: now,
    };
    const memberKeys = new Set(
      [...series.entries, ...series.extras].flatMap((entry: SeriesEntry) => entry.workKey ?? []),
    );
    memberKeys.add(workKey);
    await this.prisma.$transaction([
      this.prisma.series.upsert({
        where: { wikidataId: series.wikidataId },
        create: { wikidataId: series.wikidataId, ...data },
        update: data,
      }),
      ...[...memberKeys].map((key) =>
        this.prisma.workSeries.upsert({
          where: { workKey: key },
          create: { workKey: key, seriesWikidataId: series.wikidataId, checkedAt: now },
          update: { seriesWikidataId: series.wikidataId, checkedAt: now },
        }),
      ),
    ]);
    return series.wikidataId;
  }
}

/** A stored series, or null if its JSON isn't the expected shape (answered as no series). */
function toBookSeries(row: Series): BookSeries | null {
  const parsed = bookSeriesSchema.safeParse({
    wikidataId: row.wikidataId,
    name: row.name,
    entries: row.entries,
    extras: row.extras,
  });
  return parsed.success ? parsed.data : null;
}
