import type { AiQuota, AiQuotaResponse } from '@fandex/core';

export type AllowanceRow = { label: string; quota: AiQuota };

/** Today's allowances to show, in a fixed order; ones an older server doesn't report are left out. */
export function allowanceRows(quota: AiQuotaResponse): AllowanceRow[] {
  const rows: AllowanceRow[] = [{ label: 'Shelf scans', quota: quota.shelfScans }];
  if (quota.figureScans) rows.push({ label: 'Box scans', quota: quota.figureScans });
  if (quota.questions) rows.push({ label: 'Questions', quota: quota.questions });
  return rows;
}

/** "Resets at midnight UTC (2:00 AM your time)": allowances are counted per UTC day. */
export function resetText(now: Date): string {
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const local = midnight.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `Resets at midnight UTC (${local} your time).`;
}
