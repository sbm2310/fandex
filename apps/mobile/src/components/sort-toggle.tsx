import type { CollectionSort } from '@fandex/core';

import { SegmentedControl, type SegmentedOption } from './segmented-control';

const OPTIONS: SegmentedOption<CollectionSort>[] = [
  { value: 'recent', label: 'Recent', accessibilityLabel: 'Sort by recent' },
  { value: 'title', label: 'Title', accessibilityLabel: 'Sort by title' },
];

/** The collection's sort order. */
export function SortToggle({
  value,
  onChange,
}: {
  value: CollectionSort;
  onChange: (sort: CollectionSort) => void;
}) {
  return (
    <SegmentedControl
      options={OPTIONS}
      value={value}
      onChange={onChange}
      accessibilityLabel="Sort by"
    />
  );
}
