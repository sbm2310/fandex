import { matchBoxReading, type FigureScanResponse } from '@fandex/core';
import { Injectable } from '@nestjs/common';

import { CatalogService } from '../catalog/catalog.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { AiQuotaService } from './ai-quota.service.js';
import { ShelfReader } from './shelf-reader.service.js';

/**
 * A figure's box scanned end to end: check the allowance, read the box with the model, find
 * the shared figures it may be (its box number first, then its name), mark what the user
 * already owns, then count the scan. A box nothing could be read on still counts: the provider
 * answered.
 */
@Injectable()
export class FigureScanService {
  constructor(
    private readonly reader: ShelfReader,
    private readonly quota: AiQuotaService,
    private readonly catalog: CatalogService,
    private readonly prisma: PrismaService,
  ) {}

  get available(): boolean {
    return this.reader.available;
  }

  async scan(userId: string, images: readonly Uint8Array[]): Promise<FigureScanResponse> {
    await this.quota.assertAvailable(userId, 'figure_scan');
    const reading = await this.reader.readBox(images);
    const candidates = reading ? matchBoxReading(reading, await this.catalog.sharedFigures()) : [];

    const owned = new Set(
      (
        await this.prisma.collectionItem.findMany({
          where: { userId, catalogItemId: { in: candidates.map(({ figure }) => figure.item.id) } },
          select: { catalogItemId: true },
        })
      ).map((row) => row.catalogItemId),
    );
    return {
      reading,
      candidates: candidates.map(({ figure, by }) => ({
        item: figure.item,
        owned: owned.has(figure.item.id),
        by,
      })),
      quota: await this.quota.record(userId, 'figure_scan'),
    };
  }
}
