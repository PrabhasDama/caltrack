import { z } from "zod";
import { dateSchema } from "@/lib/date";
const money = z
  .number()
  .min(0)
  .max(1000000)
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001);
export const receiptReview = z
  .object({
    store: z.string().trim().min(1).max(120),
    date: dateSchema,
    currency: z.enum(["USD", "CAD"]),
    total: money,
    confirmed: z.literal(true),
    items: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(120),
          quantity: z.number().int().positive().max(1000000),
          price: money,
          foodId: z.string().uuid().nullable(),
          productId: z.string().uuid().nullable(),
          grams: z.number().positive().max(1000000).nullable(),
          shoppingId: z.string().uuid().nullable(),
          expected: z.string().nullable(),
        }),
      )
      .min(1)
      .max(100),
  })
  .refine(
    (d) =>
      Math.round(d.total * 100) ===
      d.items.reduce((n, i) => n + Math.round(i.quantity * i.price * 100), 0),
    "Receipt total must equal reviewed lines",
  );
export type ReceiptReview = z.infer<typeof receiptReview>;
