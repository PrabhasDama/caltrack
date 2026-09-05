import { z } from "zod";
import { dateSchema } from "@/lib/date";
export const purchaseItemSchema = z.object({
  food_id: z.string().uuid().nullable(),
  retail_product_id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(1000000),
  unit: z.enum(["g", "kg", "oz", "lb", "piece", "serving", "package"]),
  unit_price: z.number().nonnegative().max(1000000).multipleOf(0.01),
});
export const purchaseSchema = z.object({
  id: z.string().uuid(),
  updated_at: z.string().optional(),
  store_id: z.string().uuid().nullable(),
  store_name: z.string().trim().min(1).max(120),
  purchased_on: dateSchema,
  currency: z.enum(["USD", "CAD"]),
  total: z.number().nonnegative().max(1000000).multipleOf(0.01),
  notes: z.string().max(2000),
  items: z.array(purchaseItemSchema).min(1).max(100),
});
