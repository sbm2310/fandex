import {
  describeAnswer,
  parseQuestionLocally,
  queryablePreorder,
  runCollectionQuery,
  runPreorderQuery,
  runSeriesQuery,
  summarizeSeries,
  isBookItem,
  UNIVERSE_SEED,
  type AskResponse,
  type BookSeries,
  type CollectionItem,
  type PreorderResponse,
  type QueryScope,
} from '@fandex/core';

/** What the Ask screen shows for a question. */
export type AskResult = {
  question: string;
  /** What the question was about; series answers link to the Series view. */
  scope: QueryScope;
  /** "You own 3 Batman items: 2 comics and 1 LEGO set." */
  answer: string;
  /** The matching items, in the answer's order (empty when the question can't be answered). */
  items: CollectionItem[];
  /** The matching pre-orders, when the question was about pre-orders. */
  preorders: PreorderResponse[];
  method: 'ai' | 'keywords';
  /** Why keywords answered, or what was left out. */
  notice?: string;
  /** AI questions left today (signed in, when the server said). */
  questionsLeft?: number;
};

/** Guests have no pre-orders to ask about: they need an account. */
export const PREORDERS_NEED_ACCOUNT =
  'Pre-orders are kept in your account. Sign in to track them and ask about them.';

/**
 * Answers on the device with keyword matching (core's parseQuestionLocally): for guests, and
 * when the server can't be reached. `preorders` is undefined for guests (no account).
 */
export function answerOnDevice(
  question: string,
  items: readonly CollectionItem[],
  notice: string,
  {
    preorders,
    bookSeries = new Map(),
    today = new Date(),
  }: {
    preorders?: readonly PreorderResponse[];
    /** Series of owned books by work id (from the API; empty offline). */
    bookSeries?: ReadonlyMap<string, BookSeries>;
    today?: Date;
  } = {},
): AskResult {
  const query = parseQuestionLocally(question, { today });
  const base: AskResult = {
    question,
    scope: query.scope,
    answer: '',
    items: [],
    preorders: [],
    method: 'keywords',
    notice,
  };
  if (query.scope === 'series') {
    const statuses = summarizeSeries(seriesItems(items), (key) => bookSeries.get(key));
    return {
      ...base,
      answer: describeAnswer(query, runSeriesQuery(statuses, query), UNIVERSE_SEED),
    };
  }
  if (query.scope === 'preorders') {
    if (!preorders) return { ...base, answer: PREORDERS_NEED_ACCOUNT };
    const result = runPreorderQuery(preorders, query, queryablePreorder);
    return {
      ...base,
      answer: describeAnswer(query, result, UNIVERSE_SEED),
      preorders: query.unsupported ? [] : result.items,
    };
  }
  const result = runCollectionQuery(items, query);
  return {
    ...base,
    answer: describeAnswer(query, result, UNIVERSE_SEED),
    items: query.unsupported ? [] : result.items,
  };
}

/**
 * The server's answer, with its ids looked up in the collection (or the pre-orders) the app
 * already has; ids it doesn't have yet — added on another device a moment ago — are skipped.
 */
export function answerFromServer(
  question: string,
  response: AskResponse,
  items: readonly CollectionItem[],
  preorders: readonly PreorderResponse[] = [],
): AskResult {
  const pick = <T extends { id: string }>(list: readonly T[]) => {
    const byId = new Map(list.map((entry) => [entry.id, entry]));
    return response.itemIds.flatMap((id) => byId.get(id) ?? []);
  };
  const aboutPreorders = response.query.scope === 'preorders';
  return {
    question,
    scope: response.query.scope,
    answer: response.answer,
    items: aboutPreorders ? [] : pick(items),
    preorders: aboutPreorders ? pick(preorders) : [],
    method: response.method,
    ...(response.notice && { notice: response.notice }),
    questionsLeft: Math.max(0, response.quota.limit - response.quota.used),
  };
}

/** Owned books, manga and comics as series summaries need them. */
export function seriesItems(items: readonly CollectionItem[]) {
  return items.filter(isBookItem).map((item) => ({
    category: item.category,
    title: item.catalog.title,
    subtitle: item.catalog.subtitle,
    workKey: item.catalog.workKey,
  }));
}

/** Questions to start from, shown before the first one is asked. */
export const EXAMPLE_QUESTIONS = [
  'What Batman stuff do I own?',
  'How many Star Wars LEGO sets do I have?',
  "What's arriving this month?",
  'How much do I still owe?',
  'Which manga series am I missing volumes of?',
] as const;
