import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const subscribe = () => () => {};

/**
 * Web builds are statically rendered, so the server can't know the visitor's color scheme.
 * Return 'light' during static rendering and hydration, then the real scheme on the client.
 */
export function useColorScheme() {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const colorScheme = useRNColorScheme();

  return isClient ? colorScheme : 'light';
}
