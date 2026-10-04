import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useState } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
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
          <AppTabs />
        </ThemeProvider>
      </AppServicesProvider>
    </QueryClientProvider>
  );
}
