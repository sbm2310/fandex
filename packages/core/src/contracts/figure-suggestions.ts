import { z } from 'zod';

import { catalogItemSchema } from './catalog';

/**
 * A user's private figure, suggested for Fandex's shared catalog. The owner (an admin)
 * approves it as a new shared figure, merges it into an existing one, or rejects it with a
 * note. Suggesters see the outcome on the figure's page.
 */
export const FIGURE_SUGGESTION_STATUSES = ['pending', 'approved', 'merged', 'rejected'] as const;
export type FigureSuggestionStatus = (typeof FIGURE_SUGGESTION_STATUSES)[number];

const note = z
  .string()
  .trim()
  .max(500)
  .transform((value) => value || undefined);

/** POST /figure-suggestions: suggest one of your own figures (added by hand). */
export const suggestFigureRequestSchema = z.object({
  catalogItemId: z.uuid(),
  /** Anything that helps the reviewer: where it's from, a source link. */
  note: note.optional(),
});
export type SuggestFigureRequest = z.input<typeof suggestFigureRequestSchema>;

export const figureSuggestionSchema = z.object({
  id: z.uuid(),
  status: z.enum(FIGURE_SUGGESTION_STATUSES),
  /** The suggested figure; absent once it was merged (the copy is gone). */
  catalogItemId: z.uuid().optional(),
  /** Merged: the shared figure it now is. */
  mergedIntoId: z.uuid().optional(),
  note: z.string().optional(),
  /** Why it was rejected (or a reviewer's remark). */
  reviewNote: z.string().optional(),
  createdAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime().optional(),
});
export type FigureSuggestionResponse = z.infer<typeof figureSuggestionSchema>;

/** GET /figure-suggestions: the signed-in user's suggestions, newest first. */
export const figureSuggestionsResponseSchema = z.object({
  suggestions: z.array(figureSuggestionSchema),
});
export type FigureSuggestionsResponse = z.infer<typeof figureSuggestionsResponseSchema>;

/** A suggestion as an admin reviews it: the figure, who suggested it, possible duplicates. */
export const adminFigureSuggestionSchema = figureSuggestionSchema.extend({
  figure: catalogItemSchema.optional(),
  suggestedBy: z.object({ name: z.string(), email: z.string() }),
  /** Shared figures it may duplicate: `sameFigure` matches first, then similar names. */
  candidates: z.array(z.object({ item: catalogItemSchema, sameFigure: z.boolean() })),
});
export type AdminFigureSuggestion = z.infer<typeof adminFigureSuggestionSchema>;

/** GET /admin/figure-suggestions?status=: oldest first (a queue). */
export const adminFigureSuggestionsResponseSchema = z.object({
  suggestions: z.array(adminFigureSuggestionSchema),
});
export type AdminFigureSuggestionsResponse = z.infer<typeof adminFigureSuggestionsResponseSchema>;

export const suggestionStatusQuerySchema = z.enum(FIGURE_SUGGESTION_STATUSES).default('pending');

/** POST /admin/figure-suggestions/:id/merge: the shared figure it duplicates. */
export const mergeSuggestionRequestSchema = z.object({ targetId: z.uuid() });
export type MergeSuggestionRequest = z.infer<typeof mergeSuggestionRequestSchema>;

/** POST /admin/figure-suggestions/:id/reject: the suggester sees the note. */
export const rejectSuggestionRequestSchema = z.object({
  note: z.string().trim().min(1, 'Say why, for the suggester').max(500),
});
export type RejectSuggestionRequest = z.infer<typeof rejectSuggestionRequestSchema>;
