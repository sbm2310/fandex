import '@/global.css';

import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';

import { AppServicesProvider } from '@/services/app-services';
import { createDefaultServices } from '@/services/default-services';
import { createQueryClient } from '@/services/query-client';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Created once per app session (useState initializer), not on every render.
  const [queryClient] = useState(createQueryClient);
  const [services] = useState(createDefaultServices);

  // On iOS/Android, tell TanStack Query when the app returns to the foreground, so stale data
  // (e.g. a collection changed on another device) is re-read. Browsers report focus themselves.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) =>
      focusManager.setFocused(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppServicesProvider services={services}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {/* A stack over the tabs, so detail screens slide in on top with a back button. */}
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="book/[id]" options={{ title: '', headerBackTitle: 'Back' }} />
            <Stack.Screen
              name="universe/[slug]/index"
              options={{ title: '', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="universe/[slug]/[character]"
              options={{ title: '', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="edit/[id]"
              options={{ presentation: 'modal', title: 'Fix details' }}
            />
            <Stack.Screen
              name="scan"
              options={{ presentation: 'fullScreenModal', headerShown: false }}
            />
            <Stack.Screen
              name="shelf-scan"
              options={{ title: 'Scan a shelf', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="ask"
              options={{ title: 'Ask your collection', headerBackTitle: 'Back' }}
            />
          </Stack>
        </ThemeProvider>
      </AppServicesProvider>
    </QueryClientProvider>
  );
}
