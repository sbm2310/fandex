import type { CatalogBook, CatalogFigure, Isbn13 } from '@fandex/core';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ItemArtwork } from '@/components/item-artwork';
import { universeColors } from '@/constants/universe-colors';

// Tiles are hidden from screen readers (decoration next to the title), so queries include them.
const hidden = { includeHiddenElements: true } as const;

const vader: CatalogFigure = {
  source: 'fandex',
  externalId: 'hot-toys-mms-279',
  category: 'figure',
  title: 'Darth Vader',
  brand: 'Hot Toys',
  line: 'Movie Masterpiece Series',
  scale: '1/6',
  number: 'MMS 279',
  universes: ['star-wars'],
};

const book: CatalogBook = {
  source: 'openlibrary',
  externalId: 'OL1M',
  category: 'book',
  isbn13: '9780547928227' as Isbn13,
  title: 'The Hobbit',
  authors: ['J.R.R. Tolkien'],
  universes: ['middle-earth'],
};

describe('ItemArtwork', () => {
  it('shows the photo when there is one', async () => {
    await render(
      <ItemArtwork entry={{ ...vader, coverUrl: 'https://example.com/vader.jpg' }} width={120} />,
    );
    expect(screen.queryByTestId('book-cover-placeholder', hidden)).toBeNull();
  });

  it('draws a figure without a photo as its box: maker, scale and number in its universe colour', async () => {
    await render(<ItemArtwork entry={vader} width={230} />);

    expect(screen.getByText('Hot Toys', hidden)).toBeOnTheScreen();
    expect(screen.getByText('1/6', hidden)).toBeOnTheScreen();
    expect(screen.getByText('Movie Masterpiece Series', hidden)).toBeOnTheScreen();
    const number = screen.getByText('MMS\n279', hidden);
    expect(StyleSheet.flatten(number.props.style).color).toBe(
      universeColors('star-wars', 'light').accent,
    );
  });

  it('shows the name when a figure has no box number, and initials when the tile is small', async () => {
    const { number: _, ...noNumber } = vader;
    await render(<ItemArtwork entry={noNumber} width={120} />);
    expect(screen.getByText('Darth Vader', hidden)).toBeOnTheScreen();

    await render(<ItemArtwork entry={noNumber} width={44} aspectRatio={1} />);
    expect(screen.getByText('DV', hidden)).toBeOnTheScreen();
    expect(screen.queryByText('Hot Toys', hidden)).toBeNull();
  });

  it('sets a book without a cover as a title tile on its universe tint', async () => {
    await render(<ItemArtwork entry={book} width={120} />);

    expect(screen.getByText('The Hobbit', hidden)).toBeOnTheScreen();
    expect(screen.getByText('J.R.R. Tolkien', hidden)).toBeOnTheScreen();
    const tile = screen.getByTestId('book-cover-placeholder', hidden);
    expect(StyleSheet.flatten(tile.props.style).backgroundColor).toBe(
      universeColors('middle-earth', 'light').ground,
    );
  });

  it('is hidden from screen readers', async () => {
    await render(<ItemArtwork entry={book} width={120} />);
    expect(screen.queryByText('The Hobbit')).toBeNull();
  });
});
