import type { AdminFigureSuggestion } from '@fandex/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from './use-account';

import { useAdminReviews } from '@/services/app-services';

const adminKey = (userId: string | undefined) => ['admin', userId] as const;
const pendingKey = (userId: string | undefined) => ['admin', userId, 'pending'] as const;

/**
 * Whether the signed-in user is an admin. The app's user comes from the session, which doesn't
 * say, so this asks the server once (`GET /me`); false when signed out or on any error.
 */
export function useIsAdmin(): { isAdmin: boolean; isPending: boolean } {
  const { data: user, isPending: userPending } = useCurrentUser();
  const service = useAdminReviews();
  const { data, isPending } = useQuery({
    queryKey: adminKey(user?.id),
    queryFn: () => service.isAdmin(),
    enabled: !!user,
    staleTime: Infinity,
  });
  // A disabled query stays pending: only wait while signed in.
  return { isAdmin: !!user && data === true, isPending: userPending || (!!user && isPending) };
}

/** Suggestions waiting for review, oldest first (admins only). */
export function usePendingSuggestions() {
  const { data: user } = useCurrentUser();
  const service = useAdminReviews();
  return useQuery({
    queryKey: pendingKey(user?.id),
    queryFn: () => service.pending(),
    enabled: !!user,
  });
}

export type Decision =
  | { kind: 'approve'; id: string }
  | { kind: 'merge'; id: string; targetId: string }
  | { kind: 'reject'; id: string; note: string };

/**
 * Approves, merges or rejects a suggestion. A decided one leaves the pending list at once;
 * figure searches are refreshed, since the shared catalog may have changed.
 */
export function useDecideSuggestion() {
  const { data: user } = useCurrentUser();
  const service = useAdminReviews();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decision: Decision) => {
      switch (decision.kind) {
        case 'approve':
          return service.approve(decision.id);
        case 'merge':
          return service.merge(decision.id, decision.targetId);
        case 'reject':
          return service.reject(decision.id, decision.note);
      }
    },
    onSuccess: (decided) => {
      queryClient.setQueryData<AdminFigureSuggestion[]>(pendingKey(user?.id), (list = []) =>
        list.filter((suggestion) => suggestion.id !== decided.id),
      );
      void queryClient.invalidateQueries({ queryKey: ['catalog', 'figures'] });
    },
  });
}
