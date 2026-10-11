import {
  describeAnswer,
  parseQuestionLocally,
  queryablePreorder,
  runCollectionQuery,
  runPreorderQuery,
  UNIVERSE_SEED,
  type AskResponse,
  type CollectionItem,
  type PreorderResponse,
} from '@fandex/core';

/** What the Ask screen shows for a question. */
export type AskResult = {
  question: string;
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
  { preorders, today = new Date() }: { preorders?: readonly PreorderResponse[]; today?: Date } = {},
): AskResult {
  const query = parseQuestionLocally(question, { today });
  const base: AskResult = {
    question,
    answer: '',
    items: [],
    preorders: [],
    method: 'keywords',
    notice,
  };
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
    answer: response.answer,
    items: aboutPreorders ? [] : pick(items),
    preorders: aboutPreorders ? pick(preorders) : [],
    method: response.method,
    ...(response.notice && { notice: response.notice }),
    questionsLeft: Math.max(0, response.quota.limit - response.quota.used),
  };
}

/** Questions to start from, shown before the first one is asked. */
export const EXAMPLE_QUESTIONS = [
  'What Batman stuff do I own?',
  'How many Star Wars LEGO sets do I have?',
  "What's arriving this month?",
  'How much do I still owe?',
  'Which books do I have by Brandon Sanderson?',
] as const;
