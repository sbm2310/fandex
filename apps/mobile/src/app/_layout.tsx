import '@/global.css';

import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { Colors, FontFiles, Fonts } from '@/constants/theme';
import { useThemeScheme } from '@/hooks/use-theme';
import { AppServicesProvider } from '@/services/app-services';
import { createDefaultServices } from '@/services/default-services';
import { createQueryClient } from '@/services/query-client';

// Keep the splash screen up until the fonts are loaded, so text never flashes in the system font.
// Called once at module scope, as Expo recommends.
void SplashScreen.preventAutoHideAsync();

/** React Navigation's theme (headers, screen backgrounds, the web tab bar) in Fandex's colours. */
function navigationTheme(scheme: keyof typeof Colors): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme];
  const font = (fontFamily: string) => ({ fontFamily, fontWeight: 'normal' as const });
  return {
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
    fonts: {
      regular: font(Fonts.regular),
      medium: font(Fonts.semiBold),
      bold: font(Fonts.bold),
      heavy: font(Fonts.bold),
    },
  };
}

export default function RootLayout() {
  const scheme = useThemeScheme();
  // A font that fails to load falls back to the system font rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts(FontFiles);
  const ready = fontsLoaded || fontError !== null;
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

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AppServicesProvider services={services}>
        <ThemeProvider value={navigationTheme(scheme)}>
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
              name="preorder/new"
              options={{ title: 'Pre-order', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="preorder/[id]/index"
              options={{ title: '', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="preorder/[id]/edit"
              options={{ presentation: 'modal', title: 'Edit pre-order' }}
            />
            <Stack.Screen name="series" options={{ title: '', headerBackTitle: 'Back' }} />
            <Stack.Screen
              name="figure-scan"
              options={{ title: 'Scan a box', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="admin/suggestions"
              options={{ title: 'Suggestions', headerBackTitle: 'Back' }}
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
