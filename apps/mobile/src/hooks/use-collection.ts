import { isSameBook, type CatalogBook, type CollectionItem } from '@fandex/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCollectionRepository } from '@/services/app-services';

const COLLECTION_KEY = ['collection'] as const;

/** The user's collection, newest first. Local data, so it's only re-read after changes. */
export function useCollection() {
  const repository = useCollectionRepository();
  return useQuery({
    queryKey: COLLECTION_KEY,
    queryFn: () => repository.list(),
    staleTime: Infinity,
  });
}

/** One item by id; `undefined` while loading or if it isn't in the collection. */
export function useCollectionItem(id: string) {
  const collection = useCollection();
  return { ...collection, item: collection.data?.find((item) => item.id === id) };
}

/** Whether this edition is already in the collection; `undefined` until the collection has loaded. */
export function useIsInCollection(book: CatalogBook): boolean | undefined {
  const { data } = useCollection();
  return data?.some((item) => isSameBook(item.catalog, book));
}

export function useAddToCollection() {
  const repository = useCollectionRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (book: CatalogBook) => repository.add(book),
    // Put the saved item in the cache right away so the UI flips to "owned" in the same
    // render the save completes (no flash of the Add button), then re-read in the background.
    onSuccess: (item) => {
      queryClient.setQueryData<CollectionItem[]>(COLLECTION_KEY, (items = []) =>
        items.some((existing) => existing.id === item.id) ? items : [item, ...items],
      );
      void queryClient.invalidateQueries({ queryKey: COLLECTION_KEY });
    },
  });
}

export function useRemoveFromCollection() {
  const repository = useCollectionRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repository.remove(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<CollectionItem[]>(COLLECTION_KEY, (items = []) =>
        items.filter((item) => item.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey: COLLECTION_KEY });
    },
  });
}
