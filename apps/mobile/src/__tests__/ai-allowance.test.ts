import { allowanceRows, resetText } from '@/utils/ai-allowance';

describe('allowanceRows', () => {
  it('lists shelf scans, box scans and questions in that order', () => {
    const rows = allowanceRows({
      available: true,
      questions: { used: 3, limit: 30 },
      shelfScans: { used: 1, limit: 5 },
      figureScans: { used: 0, limit: 5 },
    });

    expect(rows.map((row) => row.label)).toEqual(['Shelf scans', 'Box scans', 'Questions']);
    expect(rows[2]?.quota).toEqual({ used: 3, limit: 30 });
  });

  it('leaves out what an older server does not report', () => {
    const rows = allowanceRows({ available: true, shelfScans: { used: 0, limit: 5 } });

    expect(rows.map((row) => row.label)).toEqual(['Shelf scans']);
  });
});

describe('resetText', () => {
  it('names the next UTC midnight in local time', () => {
    const now = new Date('2026-10-18T22:30:00Z');
    const midnight = new Date('2026-10-19T00:00:00Z').toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });

    expect(resetText(now)).toBe(`Resets at midnight UTC (${midnight} your time).`);
  });
});
