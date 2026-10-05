import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useCatalog, useCollectionRepositories, useLegoCatalog } from '@/services/app-services';
import { moveDeviceCollectionToAccount } from '@/services/move-to-account';

/** Moves this device's books into the signed-in account, then refreshes both collections. */
export function useMoveToAccount() {
  const { device, account } = useCollectionRepositories();
  const catalog = useCatalog();
  const legoCatalog = useLegoCatalog();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => moveDeviceCollectionToAccount({ device, account, catalog, legoCatalog }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['collection'] }),
  });
}
