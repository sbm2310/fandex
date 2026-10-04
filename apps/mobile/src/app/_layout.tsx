import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useState } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { CatalogProvider } from '@/services/catalog-context';
import { createDefaultCatalog } from '@/services/default-catalog';
import { createQueryClient } from '@/services/query-client';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Created once per app session (useState initializer), not on every render.
  const [queryClient] = useState(createQueryClient);
  const [catalog] = useState(createDefaultCatalog);

  return (
    <QueryClientProvider client={queryClient}>
      <CatalogProvider catalog={catalog}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AppTabs />
        </ThemeProvider>
      </CatalogProvider>
    </QueryClientProvider>
  );
}
