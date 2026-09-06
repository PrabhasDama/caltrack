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
  instructions: ["Boil the eggs for 12 minutes, then cool and peel."],
  cooking_minutes: 12,
  ingredients: [{ food_id: food.id, name: food.name, quantity_g: 100 }],
} as PlanDay["meals"][number];
describe("meal prep grouping", () => {
  it("consolidates matching recipe steps and preserves canonical totals", () => {
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
  it("excludes ready foods and missing instructions, and separates cooking methods", () => {
    const ready = {
      ...food,
      id: "44444444-4444-4444-8444-444444444444",
      name: "Olive oil",
      natural_unit: null,
      natural_unit_g: null,
    };
    const tasks = buildPrepTasks(
      [
        {
          date: "2026-09-06",
          meals: [
            meal,
            {
              ...meal,
              log_id: "33333333-3333-4333-8333-333333333333",
              instructions: [
                "Scramble the eggs in a skillet for 5 minutes. Cook with olive oil.",
              ],
              ingredients: [
                ...meal.ingredients,
                { food_id: ready.id, name: ready.name, quantity_g: 9 },
              ],
            },
            { ...meal, instructions: [] },
          ],
        },
      ],
      [food, ready],
      "2026-09-06",
      "2026-09-08",
    );
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.key)).toHaveLength(
      new Set(tasks.map((t) => t.key)).size,
    );
    expect(tasks.some((t) => t.food_id === ready.id)).toBe(false);
    expect(tasks.find((t) => t.name.startsWith("Boil"))?.minutes).toBe(12);
  });
  it("does not confuse serving references with a cooking method", () => {
    const rice = { ...food, name: "Rice" };
    const tasks = buildPrepTasks(
      [
        {
          date: "2026-09-06",
          meals: [
            {
              ...meal,
              ingredients: [{ food_id: food.id, name: "Rice", quantity_g: 75 }],
              instructions: [
                "Rinse rice. Bring to a boil and simmer for the package cooking time.",
                "Steam broccoli for 4–6 minutes. Serve over rice.",
              ],
              cooking_minutes: 25,
            },
          ],
        },
      ],
      [rice],
      "2026-09-06",
      "2026-09-08",
    );
    expect(tasks[0].name).toBe("Cook rice");
    expect(tasks[0].instruction).not.toContain("broccoli");
    expect(tasks[0].minutes).toBe(25);
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
