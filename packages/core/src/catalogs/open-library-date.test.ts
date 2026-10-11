import { parseOpenLibraryDate } from './open-library-date';

// Real `publish_date` values seen on Open Library (October 2026).
describe('parseOpenLibraryDate', () => {
  it.each([
    ['2026-12-08', '2026-12-08'],
    ['Nov 10th 2026', '2026-11-10'],
    ['Feb 2nd 2027', '2027-02-02'],
    ['Mar 4th 2026', '2026-03-04'],
    ['March 16, 2027', '2027-03-16'],
    ['January 5, 2027', '2027-01-05'],
    ['Sept. 3, 2026', '2026-09-03'],
    ['16th June 2026', '2026-06-16'],
    ['28.06.2027', '2027-06-28'],
    ['16/04/2025', '2025-04-16'],
    ['11/30/2027', '2027-11-30'],
    ['11/11/2027', '2027-11-11'],
  ])('reads %s as a day', (text, date) => {
    expect(parseOpenLibraryDate(text)).toEqual({ date, precision: 'day' });
  });

  it.each([
    ['December 2014', '2014-12-01'],
    ['March, 2027', '2027-03-01'],
    ['2000, January', '2000-01-01'],
    ['2027-03', '2027-03-01'],
  ])('reads %s as a month', (text, date) => {
    expect(parseOpenLibraryDate(text)).toEqual({ date, precision: 'month' });
  });

  it.each([
    ['2027', '2027-01-01'],
    // Day or month first? Can't tell, but the year is sure.
    ['01/12/2027', '2027-01-01'],
    // Not English.
    ['Mayo, 2026', '2026-01-01'],
    ['03 de Octubre de 2026', '2026-01-01'],
    ['c1995', '1995-01-01'],
    // A day the month doesn't have.
    ['February 30, 2027', '2027-01-01'],
  ])('reads only the year of %s', (text, date) => {
    expect(parseOpenLibraryDate(text)).toEqual({ date, precision: 'year' });
  });

  it.each([undefined, '', '  ', 'n.d.', '1995-1996', '[19--]'])('reads nothing in %p', (text) => {
    expect(parseOpenLibraryDate(text)).toBeNull();
  });

  it('tolerates extra spaces and capitals', () => {
    expect(parseOpenLibraryDate('  NOVEMBER  10,   2026 ')).toEqual({
      date: '2026-11-10',
      precision: 'day',
    });
  });
});
