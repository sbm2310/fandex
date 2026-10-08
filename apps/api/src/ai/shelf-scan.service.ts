import {
  matchShelfReadings,
  type CatalogItemResponse,
  type ShelfCatalog,
  type ShelfScanResponse,
} from '@fandex/core';
import { Injectable, Logger } from '@nestjs/common';

import { CatalogService } from '../catalog/catalog.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { AiQuotaService } from './ai-quota.service.js';
import { ShelfReader } from './shelf-reader.service.js';

/**
 * A shelf scan end to end: check the allowance, read the photo with the model, look every
 * reading up in our catalog (Open Library and Rebrickable, through the same cache and rate
 * limits as search), mark what the user already owns, then count the scan.
 */
@Injectable()
export class ShelfScanService {
  private readonly logger = new Logger(ShelfScanService.name);

  constructor(
    private readonly reader: ShelfReader,
    private readonly quota: AiQuotaService,
    private readonly catalog: CatalogService,
    private readonly prisma: PrismaService,
  ) {}

  get available(): boolean {
    return this.reader.available;
  }

  async scan(userId: string, images: readonly Uint8Array[]): Promise<ShelfScanResponse> {
    await this.quota.assertAvailable(userId, 'shelf_scan');
    const readings = await this.reader.read(images);

    const lego = this.catalog.legoAvailable;
    const shelfCatalog: ShelfCatalog<CatalogItemResponse> = {
      searchBooks: (query) => this.catalog.search(query),
      searchSets: lego ? (query) => this.catalog.search(query, 'lego') : null,
      lookupSet: lego ? (setNumber) => this.catalog.lookupSet(setNumber) : null,
    };
    const matches = await matchShelfReadings(
      readings,
      shelfCatalog,
      (item) => item.id,
      (reading, error) =>
        this.logger.warn(
          `Lookup failed for "${reading.title}": ${error instanceof Error ? error.message : String(error)}`,
        ),
    );

    const ids = matches.flatMap((match) => match.candidates.map((item) => item.id));
    const owned = new Set(
      (
        await this.prisma.collectionItem.findMany({
          where: { userId, catalogItemId: { in: ids } },
          select: { catalogItemId: true },
        })
      ).map((row) => row.catalogItemId),
    );

    return {
      items: matches.map(({ reading: { sure, ...reading }, candidates }) => ({
        reading,
        sure,
        candidates: candidates.map((item) => ({ item, owned: owned.has(item.id) })),
      })),
      quota: await this.quota.record(userId, 'shelf_scan'),
    };
  }
}
