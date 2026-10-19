import type { ExportFormat } from './export';

const MIME_TYPES: Record<ExportFormat, string> = {
  json: 'application/json',
  csv: 'text/csv;charset=utf-8',
};

/** Web: downloads the export (the Web Share API can't share a file made on the page everywhere). */
export async function saveExport(name: string, content: string, format: ExportFormat) {
  const url = URL.createObjectURL(new Blob([content], { type: MIME_TYPES[format] }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // After the click has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
