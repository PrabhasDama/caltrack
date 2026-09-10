import { z } from "zod";
import type { Cart } from "@/lib/optimization/engine";
import type { ShoppingItem } from "@/lib/groceries/requirements";
export const splitLineInput = z.object({
  item: z.string().uuid(),
  expected: z.string(),
  product: z.string().uuid(),
  location: z.string().uuid(),
  count: z.number().int().positive().max(1000000),
  price: z.number().nonnegative(),
  source: z.enum(["demo", "provider", "manual", "receipt", "observed"]),
  reference: z.string().uuid(),
});
export function splitProposal(cart: Cart, items: ShoppingItem[]) {
  return cart.lines
    .flatMap((l) =>
      l.packages.map((p) => {
        const item = items.find(
          (i) => i.food_id === l.food_id && i.fulfillment === "needed",
        );
        if (!item)
          throw new Error("Groceries changed. Review your current basket.");
        return {
          item: item.id,
          expected: item.updated_at,
          product: p.offer.product.id,
          location: p.offer.location.id,
          count: p.count,
          price: p.offer.price,
          source: p.offer.source,
          reference: p.offer.id,
        };
      }),
    )
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
export const splitAssignmentSchema = z.object({
  id: z.string(),
  plan_id: z.string(),
  item_id: z.string().nullable(),
  original_item_id: z.string(),
  food_id: z.string(),
  item_name: z.string(),
  store_id: z.string().nullable(),
  location_id: z.string().nullable(),
  store_name: z.string(),
  location_name: z.string(),
  product_id: z.string().nullable(),
  product_name: z.string(),
  package_g: z.coerce.number(),
  package_count: z.coerce.number(),
  original_need_g: z.coerce.number(),
  allocated_g: z.coerce.number(),
  expected_unit_price: z.coerce.number(),
  price_source: z.string(),
  price_reference_id: z.string().nullable(),
  observed_at: z.string().nullable(),
  state: z.enum([
    "pending",
    "purchased",
    "elsewhere",
    "already_have",
    "not_needed",
    "review",
  ]),
});
export const splitPlanSchema = z.object({
  id: z.string(),
  status: z.enum(["applied", "partial", "completed", "replaced", "abandoned"]),
  currency: z.enum(["USD", "CAD"]),
  expected_total: z.coerce.number(),
  baseline_total: z.coerce.number().nullable(),
  max_stores: z.coerce.number(),
  extra_store_penalty: z.coerce.number(),
  engine_version: z.string(),
  created_at: z.string(),
  assignments: z.array(splitAssignmentSchema),
});
export type SplitPlan = z.infer<typeof splitPlanSchema>;
export type SplitAssignment = z.infer<typeof splitAssignmentSchema>;
