import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AddScreen from '@/app/add';
import CollectionScreen from '@/app/index';

const routes = { index: CollectionScreen, add: AddScreen };

describe('app navigation', () => {
  it('opens on the empty collection', async () => {
    // renderRouter returns a promise with router helpers (getPathname, ...) attached to it,
    // so keep the reference and await it separately.
    const app = renderRouter(routes, { initialUrl: '/' });
    await app;

    expect(app.getPathname()).toBe('/');
    expect(screen.getByText('Your collection is empty')).toBeOnTheScreen();
  });

  it('goes to the Add screen from the empty-state button', async () => {
    const app = renderRouter(routes, { initialUrl: '/' });
    await app;

    await fireEvent.press(screen.getByRole('link', { name: 'Add your first book' }));

    expect(app.getPathname()).toBe('/add');
    expect(screen.getByText('Add a book')).toBeOnTheScreen();
  });
});
