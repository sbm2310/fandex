import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from './use-account';
import { useCollection } from './use-collection';

import { useQuestionAsker } from '@/services/app-services';
import { answerFromServer, answerOnDevice, type AskResult } from '@/utils/ask';

/**
 * Asks a question about the collection. Signed in, the server answers with AI (it falls back
 * to keywords itself when it must); signed out or offline, the device answers with keyword
 * matching. Either way the items shown come from the collection the app already has.
 */
export function useAsk() {
  const { data: user, isPending: userPending } = useCurrentUser();
  const collection = useCollection();
  const asker = useQuestionAsker();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (question: string): Promise<AskResult> => {
      const items = collection.data ?? [];
      if (!user) {
        return answerOnDevice(
          question,
          items,
          'Answered with keyword matching. Sign in to ask with AI.',
        );
      }
      try {
        const response = await asker.ask(question);
        // An answer naming items this device hasn't seen yet: refresh the collection.
        const known = new Set(items.map((item) => item.id));
        if (response.itemIds.some((id) => !known.has(id))) {
          void queryClient.invalidateQueries({ queryKey: ['collection'] });
        }
        return answerFromServer(question, response, items);
      } catch {
        return answerOnDevice(
          question,
          items,
          "Couldn't reach Fandex, so this was answered on your device with keyword matching.",
        );
      }
    },
  });
  // Who's asking and their collection must be known first, or a signed-in user's question
  // would be answered as a guest's, over an empty list.
  return { ...mutation, ready: !userPending && collection.data !== undefined };
}
