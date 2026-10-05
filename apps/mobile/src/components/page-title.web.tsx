import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

/**
 * Sets the browser tab title, e.g. "My collection · Fandex", whenever this screen is the
 * focused one and whenever the title changes.
 *
 * Not expo-router's <Head>: with stacked screens (the collection stays mounted under a detail
 * screen) and titles that change after loading, the first <Head> title won and later ones
 * never applied. Setting it on focus handles tabs, pushes and going back.
 */
export function PageTitle({ title }: { title: string }) {
  useFocusEffect(
    useCallback(() => {
      document.title = `${title} · Fandex`;
    }, [title]),
  );
  return null;
}
