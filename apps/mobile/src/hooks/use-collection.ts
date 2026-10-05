import {
  isSameBook,
  type CatalogBook,
  type CollectionItem,
  type CollectionRepository,
} from '@fandex/core';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

import { useCurrentUser } from './use-account';

import { useCollectionRepositories } from '@/services/app-services';

type ActiveCollection =
  | { status: 'loading' }
  | {
      status: 'ready';
      mode: 'device' | 'account';
      repository: CollectionRepository;
      queryKey: QueryKey;
    };

/**
 * The collection screens should use right now: the account's when signed in, the device's when
 * signed out. Cache keys include the mode (and user), so the two never mix.
 */
export function useActiveCollection(): ActiveCollection {
  const repositories = useCollectionRepositories();
  const currentUser = useCurrentUser();
  if (currentUser.isPending) return { status: 'loading' };
  const user = currentUser.data;
  return user
    ? {
        status: 'ready',
        mode: 'account',
        repository: repositories.account,
        queryKey: ['collection', 'account', user.id],
      }
    : {
        status: 'ready',
        mode: 'device',
        repository: repositories.device,
        queryKey: ['collection', 'device'],
      };
}

/** The active collection, newest first. */
export function useCollection() {
  const active = useActiveCollection();
  const ready = active.status === 'ready';
  const query = useQuery({
    queryKey: ready ? active.queryKey : ['collection', 'pending'],
    queryFn: () => (ready ? active.repository.list() : Promise.resolve([])),
    enabled: ready,
    // Device data only changes here; account data can change on other devices, so it's
    // re-read when it's 30 s old and the app/tab comes back into focus.
    staleTime: ready && active.mode === 'account' ? 30_000 : Infinity,
  });
  return { ...query, mode: ready ? active.mode : undefined };
}

/** The books saved on this device, regardless of sign-in (for moving them into an account). */
export function useDeviceCollection({ enabled }: { enabled: boolean }) {
  const { device } = useCollectionRepositories();
  return useQuery({
    queryKey: ['collection', 'device'],
    queryFn: () => device.list(),
    staleTime: Infinity,
    enabled,
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

function useActiveRepositoryOrThrow() {
  const active = useActiveCollection();
  return () => {
    if (active.status !== 'ready') throw new Error('The collection is still loading');
    return active;
  };
}

export function useAddToCollection() {
  const getActive = useActiveRepositoryOrThrow();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (book: CatalogBook) => {
      const { repository, queryKey } = getActive();
      return { item: await repository.add(book), queryKey };
    },
    // Put the saved item in the cache right away so the UI flips to "owned" in the same
    // render the save completes (no flash of the Add button), then re-read in the background.
    onSuccess: ({ item, queryKey }) => {
      queryClient.setQueryData<CollectionItem[]>(queryKey, (items = []) =>
        items.some((existing) => existing.id === item.id) ? items : [item, ...items],
      );
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useRemoveFromCollection() {
  const getActive = useActiveRepositoryOrThrow();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { repository, queryKey } = getActive();
      await repository.remove(id);
      return { id, queryKey };
    },
    onSuccess: ({ id, queryKey }) => {
      queryClient.setQueryData<CollectionItem[]>(queryKey, (items = []) =>
        items.filter((item) => item.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
