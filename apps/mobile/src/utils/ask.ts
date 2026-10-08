import {
  describeAnswer,
  parseQuestionLocally,
  runCollectionQuery,
  UNIVERSE_SEED,
  type AskResponse,
  type CollectionItem,
} from '@fandex/core';

/** What the Ask screen shows for a question. */
export type AskResult = {
  question: string;
  /** "You own 3 Batman items: 2 comics and 1 LEGO set." */
  answer: string;
  /** The matching items, in the answer's order (empty when the question can't be answered). */
  items: CollectionItem[];
  method: 'ai' | 'keywords';
  /** Why keywords answered, or what was left out. */
  notice?: string;
  /** AI questions left today (signed in, when the server said). */
  questionsLeft?: number;
};

/**
 * Answers on the device with keyword matching (core's parseQuestionLocally): for guests, and
 * when the server can't be reached.
 */
export function answerOnDevice(
  question: string,
  items: readonly CollectionItem[],
  notice: string,
  today = new Date(),
): AskResult {
  const query = parseQuestionLocally(question, { today });
  const result = runCollectionQuery(items, query);
  return {
    question,
    answer: describeAnswer(query, result, UNIVERSE_SEED),
    items: query.unsupported ? [] : result.items,
    method: 'keywords',
    notice,
  };
}

/**
 * The server's answer, with its item ids looked up in the collection the app already has
 * (ids it doesn't have yet — added on another device a moment ago — are skipped).
 */
export function answerFromServer(
  question: string,
  response: AskResponse,
  items: readonly CollectionItem[],
): AskResult {
  const byId = new Map(items.map((item) => [item.id, item]));
  return {
    question,
    answer: response.answer,
    items: response.itemIds.flatMap((id) => byId.get(id) ?? []),
    method: response.method,
    ...(response.notice && { notice: response.notice }),
    questionsLeft: Math.max(0, response.quota.limit - response.quota.used),
  };
}

/** Questions to start from, shown before the first one is asked. */
export const EXAMPLE_QUESTIONS = [
  'What Batman stuff do I own?',
  'How many Star Wars LEGO sets do I have?',
  'What did I add this month?',
  'Which books do I have by Brandon Sanderson?',
] as const;
