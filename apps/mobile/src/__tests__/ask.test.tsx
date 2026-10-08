import type { AskResponse } from '@fandex/core';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import CollectionScreen from '@/app/(tabs)/index';
import AskScreen from '@/app/ask';
import BookScreen from '@/app/book/[id]';
import { ApiQuestionAsker, AskUnavailableError } from '@/services/question-asker';
import {
  FakeAccountService,
  createFakeQuestionAsker,
  createMemoryCollection,
  createWrapper,
  dune,
  linkedFalcon,
  linkedHobbit,
  rivendell,
} from '@/test-utils/providers';
import { answerFromServer, answerOnDevice } from '@/utils/ask';

async function signedIn() {
  const account = new FakeAccountService();
  account.register('Fan', 'fan@example.com', 'correct horse battery');
  await account.signIn({ email: 'fan@example.com', password: 'correct horse battery' });
  return account;
}

/** A collection with Middle-earth (a book and a LEGO set), Star Wars and an unlinked book. */
async function collection() {
  const repository = createMemoryCollection();
  for (const entry of [linkedHobbit, rivendell, linkedFalcon, dune]) await repository.add(entry);
  return repository;
}

async function open(options: Parameters<typeof createWrapper>[0], url = '/ask') {
  // renderRouter's promise carries router helpers; keep the reference, then await it.
  const app = renderRouter(
    {
      '(tabs)/index': CollectionScreen,
      ask: AskScreen,
      'book/[id]': BookScreen,
    },
    { initialUrl: url, wrapper: createWrapper(options) },
  );
  await app;
  // The screen waits for the account and collection before taking questions.
  if (url === '/ask') await screen.findByText('Try asking');
  return { app };
}

const response = (overrides: Partial<AskResponse>): AskResponse => ({
  query: {
    universes: [],
    characters: [],
    categories: [],
    titleWords: [],
    sort: 'recent',
    answer: 'list',
  },
  answer: '',
  itemIds: [],
  unknown: [],
  method: 'ai',
  quota: { used: 1, limit: 30 },
  ...overrides,
});

describe('Ask screen', () => {
  it('answers a guest on the device with keyword matching, and says so', async () => {
    const questionAsker = createFakeQuestionAsker();
    await open({ deviceCollection: await collection(), questionAsker });

    await fireEvent.press(screen.getByRole('button', { name: 'Ask: What Batman stuff do I own?' }));
    expect(await screen.findByRole('header', { name: "You don't own any Batman items yet." }));

    await fireEvent.changeText(
      screen.getByLabelText('Your question'),
      'What Middle-earth stuff do I have?',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Ask' }));

    expect(
      await screen.findByRole('header', {
        name: 'You own 2 Middle-earth items: 1 book and 1 LEGO set.',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Answered with keyword matching. Sign in to ask with AI.'));
    expect(screen.getByRole('link', { name: 'Open The Hobbit' })).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'Open Lord of the Rings: Rivendell' }),
    ).toBeOnTheScreen();
    expect(questionAsker.ask).not.toHaveBeenCalled();
  });

  it("shows the server's AI answer with the user's items, and opens one", async () => {
    const accountCollection = await collection();
    const falconItem = (await accountCollection.list()).find(
      (item) => item.catalog.title === 'Millennium Falcon',
    );
    const questionAsker = createFakeQuestionAsker({
      ask: jest.fn(async () =>
        response({ answer: 'You own 1 Star Wars LEGO set.', itemIds: [falconItem!.id] }),
      ),
    });
    const { app } = await open({
      accountCollection,
      questionAsker,
      account: await signedIn(),
    });

    await fireEvent.changeText(
      screen.getByLabelText('Your question'),
      'How many Star Wars LEGO sets do I have?',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Ask' }));

    expect(
      await screen.findByRole('header', { name: 'You own 1 Star Wars LEGO set.' }),
    ).toBeOnTheScreen();
    expect(questionAsker.ask).toHaveBeenCalledWith('How many Star Wars LEGO sets do I have?');
    expect(screen.getByText('29 AI questions left today')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Open Millennium Falcon' }));
    expect(app.getPathname()).toBe(`/book/${falconItem!.id}`);
  });

  it("shows the server's notice when keywords answered there", async () => {
    const questionAsker = createFakeQuestionAsker({
      ask: jest.fn(async () =>
        response({
          answer: 'You own 1 Star Wars item.',
          method: 'keywords',
          notice: 'The AI is busy right now, so keywords answered.',
        }),
      ),
    });
    await open({ accountCollection: await collection(), questionAsker, account: await signedIn() });

    await fireEvent.press(screen.getByRole('button', { name: 'Ask: What Batman stuff do I own?' }));

    expect(await screen.findByText('The AI is busy right now, so keywords answered.'));
    expect(screen.queryByText(/AI questions left today/)).not.toBeOnTheScreen();
  });

  it("answers on the device when Fandex can't be reached", async () => {
    await open({
      accountCollection: await collection(),
      questionAsker: createFakeQuestionAsker(), // rejects: unavailable
      account: await signedIn(),
    });

    await fireEvent.changeText(screen.getByLabelText('Your question'), 'Any Star Wars LEGO?');
    await fireEvent.press(screen.getByRole('button', { name: 'Ask' }));

    expect(
      await screen.findByRole('header', { name: 'You own 1 Star Wars LEGO set.' }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Couldn't reach Fandex, so this was answered on your device/));
  });

  it('is opened from the Collection tab', async () => {
    const { app } = await open({ deviceCollection: await collection() }, '/');

    await fireEvent.press(
      await screen.findByRole('link', {
        name: 'Ask your collection, for example: What Batman stuff do I own?',
      }),
    );

    expect(app.getPathname()).toBe('/ask');
  });
});

describe('answers', () => {
  it("on the device: no items for a question it can't answer", async () => {
    const items = await (await collection()).list();

    const result = answerOnDevice('Which volumes am I missing?', items, 'note');

    expect(result.answer).toMatch(/^I can't answer that yet/);
    expect(result.items).toEqual([]);
  });

  it('from the server: items looked up by id, unknown ids skipped', async () => {
    const items = await (await collection()).list();

    const result = answerFromServer(
      'q',
      response({ itemIds: ['missing', items[0]!.id], quota: { used: 31, limit: 30 } }),
      items,
    );

    expect(result.items).toEqual([items[0]]);
    expect(result.questionsLeft).toBe(0);
  });
});

describe('ApiQuestionAsker', () => {
  it('posts the question and parses the answer', async () => {
    const body = response({ answer: 'You own 1 Batman item.' });
    const apiFetch = jest.fn(async (_path: string, _init?: RequestInit) => Response.json(body));

    expect(await new ApiQuestionAsker(apiFetch).ask('Batman?')).toEqual(body);
    const [path, init] = apiFetch.mock.calls[0]!;
    expect(path).toBe('/ai/ask');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ question: 'Batman?' }) });
  });

  it.each([
    ['offline', jest.fn(async () => Promise.reject(new TypeError('Network request failed')))],
    ['signed out', jest.fn(async () => new Response('{}', { status: 401 }))],
  ])('is unavailable when %s', async (_case, apiFetch) => {
    await expect(new ApiQuestionAsker(apiFetch).ask('Batman?')).rejects.toBeInstanceOf(
      AskUnavailableError,
    );
  });
});
