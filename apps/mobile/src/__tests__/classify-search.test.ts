import { classifySearch } from '@/hooks/use-book-search';

describe('classifySearch', () => {
  it.each([
    ['', { kind: 'idle' }],
    ['  h ', { kind: 'idle' }],
    ['the hobbit', { kind: 'text', query: 'the hobbit' }],
    ['1984', { kind: 'text', query: '1984' }],
    ['978-0-345-44560-5', { kind: 'isbn', isbn: '9780345445605' }],
    ['0345445600', { kind: 'isbn', isbn: '9780345445605' }],
    [' 9780345445605 ', { kind: 'isbn', isbn: '9780345445605' }],
    ['9780345445606', { kind: 'invalid-isbn', input: '9780345445606' }],
  ])('classifies %j', (input, expected) => {
    expect(classifySearch(input)).toEqual(expected);
  });
});
