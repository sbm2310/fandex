import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AccountScreen from '@/app/(tabs)/account';
import PrivacyScreen from '@/app/privacy';
import TermsScreen from '@/app/terms';
import { FEEDBACK_URL, PRIVACY_POLICY, REPOSITORY_URL, TERMS } from '@/content/legal';
import { createWrapper } from '@/test-utils/providers';

// Jest has no Expo config; the app shows the version from app.json.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

const routes = {
  '(tabs)/account': AccountScreen,
  privacy: PrivacyScreen,
  terms: TermsScreen,
};

async function renderApp(initialUrl: string) {
  const app = renderRouter(routes, { initialUrl, wrapper: createWrapper() });
  await app;
  return { getPathname: () => app.getPathname() };
}

describe('About and the legal pages', () => {
  it('shows the version, data credits and links on the Account tab, signed out', async () => {
    await renderApp('/account');

    expect(await screen.findByText(/^Fandex 1\.0\.0 · /)).toBeOnTheScreen();
    for (const name of ['Open Library', 'Rebrickable', 'Wikidata']) {
      expect(screen.getByRole('link', { name })).toBeOnTheScreen();
    }
    expect(screen.getByRole('link', { name: 'Send feedback' })).toHaveProp('href', FEEDBACK_URL);
    expect(screen.getByRole('link', { name: 'Source code on GitHub' })).toHaveProp(
      'href',
      REPOSITORY_URL,
    );
  });

  it.each([
    ['Privacy policy', '/privacy', PRIVACY_POLICY],
    ['Terms of use', '/terms', TERMS],
  ])('opens the %s from the Account tab', async (name, path, document) => {
    const app = await renderApp('/account');

    await fireEvent.press(await screen.findByRole('link', { name }));

    expect(await screen.findByRole('header', { name: document.title })).toBeOnTheScreen();
    expect(app.getPathname()).toBe(path);
  });

  it.each([
    ['/privacy', PRIVACY_POLICY],
    ['/terms', TERMS],
  ])('%s can be opened directly and lists every section', async (path, document) => {
    await renderApp(path);

    expect(await screen.findByText(`Last updated ${document.updated}`)).toBeOnTheScreen();
    for (const section of document.sections) {
      expect(screen.getByRole('header', { name: section.heading })).toBeOnTheScreen();
    }
  });
});
