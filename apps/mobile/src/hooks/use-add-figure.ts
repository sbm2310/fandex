import { createFigure, type CollectionItem, type NewFigure } from '@fandex/core';
import { randomUUID } from 'expo-crypto';
import { useMutation } from '@tanstack/react-query';

import { useCurrentUser } from './use-account';
import { useAddToCollection } from './use-collection';

import { useCustomItems } from '@/services/app-services';

/**
 * Adds a figure described by hand. Signed in, the server saves it (private to the user) and
 * links its universes; as a guest it's made on the device, linked with the same matcher.
 * Either way it then goes into the collection like anything else.
 */
export function useAddFigure() {
  const { data: user } = useCurrentUser();
  const customItems = useCustomItems();
  const add = useAddToCollection();

  return useMutation({
    mutationFn: async (figure: NewFigure): Promise<CollectionItem> => {
      const entry = user
        ? await customItems.createFigure(figure)
        : createFigure(figure, { externalId: randomUUID() });
      const { item } = await add.mutateAsync(entry);
      return item;
    },
  });
}
