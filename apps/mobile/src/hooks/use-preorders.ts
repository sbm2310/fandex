import type {
  CreatePreorderRequest,
  NewFigure,
  PreorderResponse,
  UpdatePreorderRequest,
} from '@fandex/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from './use-account';

import { useCustomItems, usePreorderService } from '@/services/app-services';

const preordersKey = (userId: string | undefined) => ['preorders', userId] as const;

/** The signed-in user's pre-orders, newest first (none, and nothing fetched, when signed out). */
export function usePreorders() {
  const { data: user, isPending: userPending } = useCurrentUser();
  const service = usePreorderService();
  const query = useQuery({
    queryKey: preordersKey(user?.id),
    queryFn: () => service.list(),
    enabled: !!user,
    staleTime: 30_000,
  });
  return { ...query, signedIn: !!user, userPending };
}

/** One pre-order by id, from the list. */
export function usePreorder(id: string) {
  const preorders = usePreorders();
  return { ...preorders, preorder: preorders.data?.find((preorder) => preorder.id === id) };
}

/** Keeps the cached list in step with what the server answered (no refetch flash). */
function usePutInCache() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  return (preorder: PreorderResponse) =>
    queryClient.setQueryData<PreorderResponse[]>(preordersKey(user?.id), (list = []) =>
      list.some((existing) => existing.id === preorder.id)
        ? list.map((existing) => (existing.id === preorder.id ? preorder : existing))
        : [preorder, ...list],
    );
}

export type NewPreorder =
  | { kind: 'catalog'; request: CreatePreorderRequest }
  /** A figure that isn't saved yet: created on the server first, then pre-ordered. */
  | { kind: 'figure'; figure: NewFigure; request: Omit<CreatePreorderRequest, 'catalogItemId'> };

export function useCreatePreorder() {
  const service = usePreorderService();
  const customItems = useCustomItems();
  const putInCache = usePutInCache();
  return useMutation({
    mutationFn: async (input: NewPreorder) => {
      if (input.kind === 'catalog') return service.create(input.request);
      const figure = await customItems.createFigure(input.figure);
      return service.create({ ...input.request, catalogItemId: figure.catalogId! });
    },
    onSuccess: putInCache,
  });
}

export function useUpdatePreorder() {
  const service = usePreorderService();
  const putInCache = usePutInCache();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdatePreorderRequest }) =>
      service.update(id, changes),
    onSuccess: putInCache,
  });
}

/** It arrived: the server closes it and adds the item to the collection, which is re-read. */
export function useArrivePreorder() {
  const service = usePreorderService();
  const putInCache = usePutInCache();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => service.arrive(id),
    onSuccess: async ({ preorder }) => {
      putInCache(preorder);
      await queryClient.invalidateQueries({ queryKey: ['collection'] });
    },
  });
}

export function useDeletePreorder() {
  const { data: user } = useCurrentUser();
  const service = usePreorderService();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => service.remove(id),
    onSuccess: (_result, id) =>
      queryClient.setQueryData<PreorderResponse[]>(preordersKey(user?.id), (list = []) =>
        list.filter((preorder) => preorder.id !== id),
      ),
  });
}
