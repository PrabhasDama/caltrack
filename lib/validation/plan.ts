import { z } from "zod";
import { dateSchema } from "@/lib/date";
export const savePlanSchema = z.object({
  revision: z.number().int().nonnegative(),
  days: z
    .array(
      z.object({
        date: dateSchema,
        meals: z
          .array(
            z.object({
              template_id: z.string().uuid(),
              slot: z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]),
              ingredients: z
                .array(
                  z.object({
                    food_id: z.string().uuid(),
                    quantity_g: z.number().positive().max(6000),
                  }),
                )
                .min(1)
                .max(15),
            }),
          )
          .min(2)
          .max(5),
      }),
    )
    .min(1)
    .max(14),
});
