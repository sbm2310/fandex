import type { AiQuotaResponse } from '@fandex/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from './use-account';

import { useShelfScanner } from '@/services/app-services';
import { toShelfScanError, type ShelfPhoto } from '@/services/shelf-scanner';

export const aiQuotaKey = (userId: string | undefined) => ['ai', 'quota', userId] as const;

/** Whether AI scanning is available, and today's allowances (signed-in users only). */
export function useAiQuota() {
  const { data: user } = useCurrentUser();
  const scanner = useShelfScanner();
  return useQuery({
    queryKey: aiQuotaKey(user?.id),
    queryFn: () => scanner.quota(),
    enabled: !!user,
    retry: false,
  });
}

/** Reads a shelf photo; the allowance shown updates from the answer. */
export function useShelfScan() {
  const { data: user } = useCurrentUser();
  const scanner = useShelfScanner();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photo: ShelfPhoto) => scanner.scan(photo),
    onSuccess: ({ quota }) =>
      // Keep the rest (provider, other allowances): only the shelf allowance changed.
      queryClient.setQueryData<AiQuotaResponse>(aiQuotaKey(user?.id), (current) => ({
        ...current,
        available: current?.available ?? true,
        shelfScans: quota,
      })),
    onError: (error) => {
      // "Used up" here means the allowance shown is out of date: re-read it.
      if (toShelfScanError(error).kind === 'quota') {
        void queryClient.invalidateQueries({ queryKey: aiQuotaKey(user?.id) });
      }
    },
  });
}
