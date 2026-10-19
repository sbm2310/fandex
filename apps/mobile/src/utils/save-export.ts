import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { ExportFormat } from './export';

const TYPES: Record<ExportFormat, { mimeType: string; UTI: string }> = {
  json: { mimeType: 'application/json', UTI: 'public.json' },
  csv: { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
};

/**
 * iOS/Android: writes the export to the app's cache folder and opens the share sheet, where
 * the user saves it to Files, mails it, or opens it in another app. (Web: save-export.web.ts.)
 */
export async function saveExport(name: string, content: string, format: ExportFormat) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing isn't available on this device.");
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(content);
  await Sharing.shareAsync(file.uri, { ...TYPES[format], dialogTitle: name });
}
