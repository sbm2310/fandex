import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useState } from 'react';
import { useColorScheme } from 'react-native';

import { AppServicesProvider } from '@/services/app-services';
import { createDefaultServices } from '@/services/default-services';
import { createQueryClient } from '@/services/query-client';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Created once per app session (useState initializer), not on every render.
  const [queryClient] = useState(createQueryClient);
  const [services] = useState(createDefaultServices);

  return (
    <QueryClientProvider client={queryClient}>
      <AppServicesProvider services={services}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {/* A stack over the tabs, so detail screens slide in on top with a back button. */}
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="book/[id]" options={{ title: '', headerBackTitle: 'Back' }} />
            <Stack.Screen
              name="scan"
              options={{ presentation: 'fullScreenModal', headerShown: false }}
            />
          </Stack>
        </ThemeProvider>
      </AppServicesProvider>
    </QueryClientProvider>
  );
}
