import { z } from "zod";
import { dateSchema } from "@/lib/date";
export const foodUnitSchema = z.enum([
  "g",
  "kg",
  "oz",
  "lb",
  "piece",
  "serving",
]);
export const pantrySchema = z
  .object({
    id: z.string().uuid().optional(),
    updated_at: z.string().optional(),
    food_id: z.string().uuid(),
    quantity: z.number().nonnegative().max(1000000),
    unit: foodUnitSchema,
    low_threshold_g: z.number().nonnegative().max(1000000),
    purchased_on: dateSchema.nullable(),
    expires_on: dateSchema.nullable(),
  })
  .refine(
    (d) => !d.purchased_on || !d.expires_on || d.expires_on >= d.purchased_on,
    { message: "Expiration cannot be before purchase.", path: ["expires_on"] },
  );
export const manualShoppingSchema = z.object({
  food_id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  amount: z.number().positive().max(1000000),
  unit: foodUnitSchema,
});
