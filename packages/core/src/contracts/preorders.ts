import { z } from 'zod';

import { CURRENCIES } from '../preorders/money';
import { DATE_CHANGE_SOURCES, PREORDER_STATUSES } from '../preorders/preorder';
import { catalogItemSchema } from './catalog';
import { releaseDateSchema } from './release-date';

const day = z.iso.date(); // YYYY-MM-DD

export const dateChangeSchema = z.object({
  from: releaseDateSchema.nullable(),
  to: releaseDateSchema.nullable(),
  changedAt: z.iso.datetime(),
  source: z.enum(DATE_CHANGE_SOURCES),
});

const amount = z.number().int().min(0).max(100_000_000_00); // minor units, up to 100 million

/** Text the user typed: trimmed; blank means "none". */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined);

const orderUrl = z
  .url({ protocol: /^https?$/, error: 'The order link must be a web address' })
  .max(2000);

/** A pre-order as the API returns it, with the catalog item it's for. */
export const preorderSchema = z.object({
  id: z.uuid(),
  status: z.enum(PREORDER_STATUSES),
  catalog: catalogItemSchema,
  currency: z.enum(CURRENCIES),
  /** Total price in minor units (cents), when known. */
  price: amount.optional(),
  /** Paid so far in minor units: the deposit and any payments since. */
  paid: amount,
  balanceDueDate: day.optional(),
  expectedRelease: releaseDateSchema.optional(),
  /** The expected release is the catalog's (Open Library's) and moves when it does. */
  followsCatalogDate: z.boolean().default(false),
  store: z.string().optional(),
  orderNumber: z.string().optional(),
  orderUrl: z.string().optional(),
  notes: z.string().optional(),
  /** Every change of the expected date, oldest first. */
  history: z.array(dateChangeSchema),
  createdAt: z.iso.datetime(),
  /** When it was marked arrived (and moved into the collection). */
  arrivedAt: z.iso.datetime().optional(),
});
export type PreorderResponse = z.infer<typeof preorderSchema>;

/** GET /preorders: the user's pre-orders, newest first. */
export const preordersResponseSchema = z.object({ preorders: z.array(preorderSchema) });
export type PreordersResponse = z.infer<typeof preordersResponseSchema>;

const paidWithinPrice = (value: { price?: number | null | undefined; paid?: number | undefined }) =>
  value.price == null || value.paid === undefined || value.paid <= value.price;
const paidMessage = { message: "What's paid can't be more than the price", path: ['paid'] };

/** POST /preorders. */
export const createPreorderRequestSchema = z
  .object({
    catalogItemId: z.uuid(),
    currency: z.enum(CURRENCIES).default('USD'),
    price: amount.optional(),
    paid: amount.default(0),
    balanceDueDate: day.optional(),
    expectedRelease: releaseDateSchema.optional(),
    store: text(100).optional(),
    orderNumber: text(100).optional(),
    orderUrl: orderUrl.optional(),
    notes: text(1000).optional(),
  })
  .refine(paidWithinPrice, paidMessage);
export type CreatePreorderRequest = z.input<typeof createPreorderRequestSchema>;
/** A create request after validation: defaults filled, text trimmed, dates normalized. */
export type CreatePreorderInput = z.output<typeof createPreorderRequestSchema>;

/**
 * PATCH /preorders/:id. Fields left out stay as they are; null clears one. Status can move
 * between ordered and cancelled here; "arrived" has its own endpoint (it adds to the collection).
 */
export const updatePreorderRequestSchema = z
  .object({
    status: z.enum(['ordered', 'cancelled']).optional(),
    currency: z.enum(CURRENCIES).optional(),
    price: amount.nullable().optional(),
    paid: amount.optional(),
    balanceDueDate: day.nullable().optional(),
    expectedRelease: releaseDateSchema.nullable().optional(),
    store: text(100).nullable().optional(),
    orderNumber: text(100).nullable().optional(),
    orderUrl: orderUrl.nullable().optional(),
    notes: text(1000).nullable().optional(),
  })
  .refine(paidWithinPrice, paidMessage)
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to change',
  });
export type UpdatePreorderRequest = z.input<typeof updatePreorderRequestSchema>;
export type UpdatePreorderInput = z.output<typeof updatePreorderRequestSchema>;
