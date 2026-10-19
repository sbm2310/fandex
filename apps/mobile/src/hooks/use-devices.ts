import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from './use-account';

import { useDeviceSessions } from '@/services/app-services';

const devicesKey = (userId: string | undefined) => ['account', 'devices', userId] as const;

/** The devices the signed-in user is signed in on, most recently active first. */
export function useDevices() {
  const { data: user } = useCurrentUser();
  const service = useDeviceSessions();
  return useQuery({
    queryKey: devicesKey(user?.id),
    queryFn: () => service.list(),
    enabled: !!user,
    retry: false,
  });
}

function useDeviceMutation<TInput, TResult>(action: (input: TInput) => Promise<TResult>) {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSettled: () => queryClient.invalidateQueries({ queryKey: devicesKey(user?.id) }),
  });
}

export function useSignOutDevice() {
  const service = useDeviceSessions();
  return useDeviceMutation((id: string) => service.signOut(id));
}

export function useSignOutOtherDevices() {
  const service = useDeviceSessions();
  return useDeviceMutation(() => service.signOutOthers());
}
