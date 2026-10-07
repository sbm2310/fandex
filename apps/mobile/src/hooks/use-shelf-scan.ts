import type { AiQuotaResponse } from '@fandex/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from './use-account';

import { useShelfScanner } from '@/services/app-services';
import { toShelfScanError, type ShelfPhoto } from '@/services/shelf-scanner';

const quotaKey = (userId: string | undefined) => ['ai', 'quota', userId] as const;

/** Whether shelf scanning is available, and today's allowance (signed-in users only). */
export function useAiQuota() {
  const { data: user } = useCurrentUser();
  const scanner = useShelfScanner();
  return useQuery({
    queryKey: quotaKey(user?.id),
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
      queryClient.setQueryData<AiQuotaResponse>(quotaKey(user?.id), (current) => ({
        available: current?.available ?? true,
        shelfScans: quota,
      })),
    onError: (error) => {
      // "Used up" here means the allowance shown is out of date: re-read it.
      if (toShelfScanError(error).kind === 'quota') {
        void queryClient.invalidateQueries({ queryKey: quotaKey(user?.id) });
      }
    },
  });
}
