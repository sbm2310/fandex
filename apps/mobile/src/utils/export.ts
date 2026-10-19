import {
  findCharacter,
  findUniverse,
  isBookItem,
  itemLinks,
  type CatalogEntry,
  type CollectionItem,
  type PreorderResponse,
} from '@fandex/core';

import { CATEGORY_LABELS } from '@/components/category-badge';

/** Bumped when the JSON layout changes, so a later import can read older files. */
export const EXPORT_FORMAT_VERSION = 1;

export type ExportFormat = 'json' | 'csv';

/** "fandex-collection-2026-10-19.json" (the device's calendar day). */
export function exportFileName(format: ExportFormat, today: string): string {
  return `fandex-collection-${today}.${format}`;
}

/**
 * Everything: each item as the app keeps it (catalog snapshot, the user's category and link
 * fixes) plus the links as shown, and pre-orders with money, dates and history.
 */
export function collectionJson(
  items: readonly CollectionItem[],
  preorders: readonly PreorderResponse[],
  now: Date,
): string {
  return JSON.stringify(
    {
      fandexExport: EXPORT_FORMAT_VERSION,
      exportedAt: now.toISOString(),
      collection: items.map((item) => ({
        ...item,
        catalog: withoutSignals(item.catalog),
        links: itemLinks(item),
      })),
      preorders,
    },
    null,
    2,
  );
}

const CSV_COLUMNS = [
  'Title',
  'Subtitle',
  'Category',
  'By',
  'ISBN',
  'Set number',
  'Figure number',
  'Universes',
  'Characters',
  'Added',
] as const;

/** One row per item, for spreadsheets. UTF-8 with a byte-order mark so Excel reads Hebrew right. */
export function collectionCsv(items: readonly CollectionItem[]): string {
  const rows = items.map((item) => {
    const links = itemLinks(item);
    return [
      item.catalog.title,
      isBookItem(item) ? (item.catalog.subtitle ?? '') : '',
      CATEGORY_LABELS[item.category],
      creators(item),
      isBookItem(item) ? (item.catalog.isbn13 ?? '') : '',
      item.category === 'lego' ? item.catalog.setNumber : '',
      item.category === 'figure' ? (item.catalog.number ?? '') : '',
      links.universes.map((slug) => findUniverse(slug)?.name ?? slug).join('; '),
      links.characters
        .map((ref) => findCharacter(ref.universe, ref.character)?.name ?? ref.character)
        .join('; '),
      item.addedAt.slice(0, 10),
    ];
  });
  return '﻿' + [[...CSV_COLUMNS], ...rows].map(csvLine).join('\r\n') + '\r\n';
}

function creators(item: CollectionItem): string {
  if (isBookItem(item)) return item.catalog.authors.join('; ');
  if (item.category === 'figure') return item.catalog.brand ?? '';
  return 'LEGO';
}

/** RFC 4180 quoting, plus a leading ' on cells a spreadsheet would run as a formula. */
export function csvLine(cells: readonly string[]): string {
  return cells
    .map((cell) => {
      const safe = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
      return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
    })
    .join(',');
}

/** Match signals are the catalog's internal matching data, not part of the user's collection. */
function withoutSignals(entry: CatalogEntry): CatalogEntry {
  if (!('matchSignals' in entry)) return entry;
  const { matchSignals: _signals, ...rest } = entry;
  return rest as CatalogEntry;
}
