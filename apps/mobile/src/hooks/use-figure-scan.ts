import type { AiQuotaResponse } from '@fandex/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from './use-account';
import { aiQuotaKey } from './use-shelf-scan';

import { useFigureScanner } from '@/services/app-services';
import { toShelfScanError, type ShelfPhoto } from '@/services/shelf-scanner';

/** Reads a figure's box; the allowance shown updates from the answer. */
export function useFigureScan() {
  const { data: user } = useCurrentUser();
  const scanner = useFigureScanner();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photo: ShelfPhoto) => scanner.scan(photo),
    onSuccess: ({ quota }) =>
      queryClient.setQueryData<AiQuotaResponse>(aiQuotaKey(user?.id), (current) =>
        current ? { ...current, figureScans: quota } : current,
      ),
    onError: (error) => {
      // "Used up" here means the allowance shown is out of date: re-read it.
      if (toShelfScanError(error).kind === 'quota') {
        void queryClient.invalidateQueries({ queryKey: aiQuotaKey(user?.id) });
      }
    },
  });
}
