import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAccountService } from '@/services/app-services';

const CURRENT_USER_KEY = ['account', 'me'] as const;

/** The signed-in user (`null` when signed out). */
export function useCurrentUser() {
  const account = useAccountService();
  return useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: () => account.getCurrentUser(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** Wraps an account action so the current user is re-read once it succeeds. */
function useAccountMutation<TInput>(action: (input: TInput) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY }),
  });
}

export function useSignUp() {
  const account = useAccountService();
  return useAccountMutation((input: Parameters<typeof account.signUp>[0]) => account.signUp(input));
}

export function useSignIn() {
  const account = useAccountService();
  return useAccountMutation((input: Parameters<typeof account.signIn>[0]) => account.signIn(input));
}

export function useSignOut() {
  const account = useAccountService();
  return useAccountMutation(() => account.signOut());
}

export function useDeleteAccount() {
  const account = useAccountService();
  return useAccountMutation((input: { password: string }) => account.deleteAccount(input));
}
