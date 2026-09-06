import { describe, it, expect } from "vitest";
import { buildPrepTasks, prepAvailability } from "@/lib/prep/planning";
import { formatFoodQuantity } from "@/lib/food/quantities";
import type { CatalogFood, PlanDay } from "@/lib/meal-plan/types";
const food = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Eggs",
  natural_unit: "egg",
  natural_unit_g: 50,
  piece_g: 50,
  preparation: "Raw",
  category: "protein",
} as CatalogFood;
const meal = {
  key: "one",
  log_id: "22222222-2222-4222-8222-222222222222",
  status: "planned",
  name: "Egg toast",
  ingredients: [{ food_id: food.id, name: food.name, quantity_g: 100 }],
} as PlanDay["meals"][number];
describe("meal prep grouping", () => {
  it("groups shared ingredients and preserves canonical totals", () => {
    const tasks = buildPrepTasks(
      [
        {
          date: "2026-09-06",
          meals: [
            meal,
            { ...meal, log_id: "33333333-3333-4333-8333-333333333333" },
          ],
        },
      ],
      [food],
      "2026-09-06",
      "2026-09-08",
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0].quantity_g).toBe(200);
    expect(tasks[0].meal_ids).toHaveLength(2);
    expect(formatFoodQuantity(tasks[0].quantity_g, food, "imperial")).toBe(
      "4 eggs",
    );
    expect(formatFoodQuantity(tasks[0].quantity_g, food, "metric")).toBe(
      "4 eggs",
    );
  });
  it("excludes eaten, skipped and unsaved meals", () => {
    expect(
      buildPrepTasks(
        [
          {
            date: "2026-09-06",
            meals: [
              { ...meal, status: "completed" },
              { ...meal, status: "skipped" },
              { ...meal, log_id: undefined },
            ],
          },
        ],
        [food],
        "2026-09-06",
        "2026-09-08",
      ),
    ).toEqual([]);
  });
  it("uses stock without mutating it and ignores expired ingredients", () => {
    const task = buildPrepTasks(
      [{ date: "2026-09-06", meals: [meal] }],
      [food],
      "2026-09-06",
      "2026-09-08",
    )[0];
    const pantry = [
      { food_id: food.id, quantity_g: 50, expires_on: "2026-09-05" },
    ];
    expect(
      prepAvailability(
        task,
        pantry as Parameters<typeof prepAvailability>[1],
        "2026-09-06",
      ),
    ).toEqual({ available: 0, missing: 100 });
    expect(pantry[0].quantity_g).toBe(50);
  });
});
