import type { CatalogFigure, FigureSuggestionResponse } from '@fandex/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from './use-account';

import { useFigureSuggestionService } from '@/services/app-services';

const suggestionsKey = (userId: string | undefined) => ['figure-suggestions', userId] as const;

/** The signed-in user's figure suggestions (none, and nothing fetched, when signed out). */
export function useMySuggestions() {
  const { data: user } = useCurrentUser();
  const service = useFigureSuggestionService();
  return useQuery({
    queryKey: suggestionsKey(user?.id),
    queryFn: () => service.mine(),
    enabled: !!user,
    staleTime: 30_000,
  });
}

/**
 * The suggestion about this figure, if any: the one made for it (pending, rejected, or
 * approved — it's shared now), or one merged into it (the user's copy now points here).
 */
export function useSuggestionFor(figure: CatalogFigure): {
  suggestion: FigureSuggestionResponse | undefined;
  isPending: boolean;
} {
  const { data, isPending, isEnabled } = useMySuggestions();
  const id = figure.catalogId;
  const suggestion = id
    ? data?.find((s) => s.catalogItemId === id || s.mergedIntoId === id)
    : undefined;
  return { suggestion, isPending: isEnabled && isPending };
}

/** Suggests one of the user's figures; the answer goes straight into the cached list. */
export function useSuggestFigure() {
  const { data: user } = useCurrentUser();
  const service = useFigureSuggestionService();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ catalogItemId, note }: { catalogItemId: string; note?: string }) =>
      service.suggest(catalogItemId, note),
    onSuccess: (suggestion) =>
      queryClient.setQueryData<FigureSuggestionResponse[]>(
        suggestionsKey(user?.id),
        (list = []) => [suggestion, ...list.filter((existing) => existing.id !== suggestion.id)],
      ),
  });
}
