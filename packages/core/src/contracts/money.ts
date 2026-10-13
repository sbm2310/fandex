import { z } from 'zod';

import { CURRENCIES } from '../preorders/money';

/** An amount in minor units (cents), up to 100 million. */
export const amountSchema = z.number().int().min(0).max(100_000_000_00);

/** An amount with its currency (core's `Money`). */
export const moneySchema = z.object({ amount: amountSchema, currency: z.enum(CURRENCIES) });
