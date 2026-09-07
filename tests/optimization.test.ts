import { describe, it, expect } from "vitest";
import {
  choosePackages,
  compareCarts,
  planRequirements,
  priceQuality,
  scorePlan,
  smartSwapDelta,
  weights,
  type Offer,
  type OptimizationData,
} from "@/lib/optimization/engine";
import { createScoreCache } from "@/lib/optimization/cache";
import type { PlanContext, PlanDay, PlannedMeal } from "@/lib/meal-plan/types";
const offer = (
  id: string,
  food: string,
  store: string,
  price: number,
  grams = 600,
): Offer => ({
  id,
  price,
  currency: "USD",
  observed_at: "2026-09-07T12:00:00Z",
  provider: "demo",
  source: "demo",
  is_demo: true,
  promotion: null,
  product: {
    id,
    food_id: food,
    name: id,
    package_amount: 1,
    package_unit: "package",
    package_grams: grams,
  },
  location: {
    id: store,
    store_id: store,
    name: store,
    country_code: "US",
    currency: "USD",
    is_demo: true,
  },
});
const offers = [
  offer("a-eggs", "eggs", "a", 2),
  offer("a-rice", "rice", "a", 9),
  offer("b-eggs", "eggs", "b", 8),
  offer("b-rice", "rice", "b", 2),
];
const data: OptimizationData = {
  offers,
  spent: 20,
  shoppingDays: 2,
  preferredStores: ["a"],
  distancesKm: {},
  maxStores: 2,
  extraStorePenalty: 1,
  travelCostPerKm: 0,
};
const requirements = [
  { food_id: "eggs", name: "Eggs", grams: 400 },
  { food_id: "rice", name: "Rice", grams: 500 },
];
const macros = { calories: 500, protein: 30, carbs: 60, fat: 15, fiber: 5 };
const meal: PlannedMeal = {
  key: "meal",
  name: "Egg rice",
  template_id: "one",
  slot: "Lunch",
  ingredients: requirements.map((r) => ({
    food_id: r.food_id,
    name: r.name,
    quantity_g: r.grams,
  })),
  macros,
  instructions: [],
  cooking_minutes: 10,
};
const days: PlanDay[] = [{ date: "2026-09-07", meals: [meal] }];
const context = {
  ownerId: "alice",
  today: "2026-09-07",
  days: [],
  foods: [],
  templates: [],
  targets: macros,
  preferences: {
    monthlyBudget: 200,
    currency: "USD",
    mealsPerDay: 2,
    repeatTolerance: "variety",
  },
  optimization: data,
  pantry: [],
} as unknown as PlanContext;
describe("deterministic optimization", () => {
  it("separates requirements from packages and leftovers", () => {
    const p = choosePackages(requirements[0], offers)!;
    expect(p.requiredG).toBe(400);
    expect(p.grams).toBe(600);
    expect(p.leftoverG).toBe(200);
    expect(p.cost).toBe(2);
  });
  it("finds a smaller sufficient two-size combination", () => {
    const p = choosePackages({ ...requirements[0], grams: 900 }, [
      offer("small", "eggs", "a", 2, 400),
      offer("large", "eggs", "a", 3, 600),
    ])!;
    expect(p.grams).toBe(1000);
    expect(p.packages).toHaveLength(2);
  });
  it("compares single, split, preferred baseline, and convenience penalties", () => {
    const c = compareCarts(requirements, data, "USD");
    expect(c.single.total).toBe(10);
    expect(c.bestSplit.total).toBe(4);
    expect(c.bestSplit.stores).toHaveLength(2);
    expect(c.savings).toBe(7);
    expect(c.fewest.stores).toHaveLength(1);
    expect(
      compareCarts(requirements, { ...data, extraStorePenalty: 20 }, "USD")
        .bestSplit.stores,
    ).toHaveLength(1);
  });
  it("never invents total/savings for unpriced items or a foreign currency", () => {
    const c = compareCarts(
      [...requirements, { food_id: "unknown", name: "Unknown", grams: 10 }],
      data,
      "USD",
    );
    expect(c.bestSplit.total).toBeNull();
    expect(c.savings).toBeNull();
    expect(
      compareCarts(requirements, data, "CAD").bestSplit.lines,
    ).toHaveLength(0);
  });
  it("allocates stock only once and predicts shortages at expiry", () => {
    const p = planRequirements(
      [...days, { date: "2026-09-09", meals: [meal] }],
      {
        today: context.today,
        pantry: [
          { food_id: "eggs", quantity_g: 600, expires_on: "2026-09-08" },
        ] as PlanContext["pantry"],
      },
    );
    expect(p.requirements.find((r) => r.food_id === "eggs")?.grams).toBe(400);
    expect(p.runout.find((r) => r.food_id === "eggs")?.date).toBe("2026-09-09");
    expect(p.coveredG).toBe(400);
  });
  it("scores cost, pantry and objective weights using the same inputs", () => {
    const empty = scorePlan(days, context, "Lowest Cost");
    const stocked = scorePlan(
      days,
      {
        ...context,
        pantry: requirements.map((r) => ({
          food_id: r.food_id,
          quantity_g: 600,
          expires_on: null,
        })) as PlanContext["pantry"],
      },
      "Lowest Cost",
    );
    expect(stocked.estimatedSpend).toBe(0);
    expect(stocked.score).toBeLessThan(empty.score);
    expect(weights["Best Macro Fit"].nutrition).toBeGreaterThan(
      weights["Lowest Cost"].nutrition,
    );
    expect(empty.remaining).toBe(180);
  });
  it("compares actual weekly package changes and macro deltas", () => {
    const next = {
      ...meal,
      ingredients: [meal.ingredients[0]],
      macros: { ...macros, protein: 35, carbs: 40 },
    };
    const d = smartSwapDelta(meal, next, days, context);
    expect(d.weekSavings).toBe(2);
    expect(d.macros.protein).toBe(5);
    expect(d.macros.carbs).toBe(-20);
  });
  it("requires distinct historical dates and keeps demo provenance", () => {
    expect(priceQuality(offers[0], context.today).average).toBeNull();
    const q = priceQuality(
      {
        ...offers[0],
        history: [1, 2, 3].map((n) => ({
          price: 4,
          observed_at: `2026-09-0${n}T00:00:00Z`,
        })),
      },
      context.today,
    );
    expect(q.average).toBe(4);
    expect(q.status).toContain("Demo history");
  });
  it("reuses unchanged results and invalidates all inputs including owner", () => {
    const c = createScoreCache();
    const a = c.get(days, context, "Balanced");
    expect(c.get(days, context, "Balanced")).toBe(a);
    expect(c.get(days, { ...context, ownerId: "bob" }, "Balanced")).not.toBe(a);
    expect(
      c.get(
        days,
        { ...context, optimization: { ...data, spent: 100 } },
        "Balanced",
      ),
    ).not.toBe(a);
    c.clear();
    expect(c.get(days, context, "Balanced")).not.toBe(a);
  });
});

import {
  mergeObservedPrices,
  type PurchaseObservation,
} from "@/lib/optimization/prices";
import { estimateMeal, rankSwaps } from "@/lib/meal-plan/discovery";
import { optimizePlan, objectives } from "@/lib/optimization/engine";
import fixture from "./catalog-fixture.json";
import recipes from "./phase65-recipes.json";
const actualContext: PlanContext = {
  ...context,
  revision: 0,
  units: "metric",
  foods: fixture.foods.map((r) => ({
    id: String(r[0]),
    name: String(r[0]),
    nutrition: {
      calories: Number(r[1]),
      protein: Number(r[2]),
      carbs: Number(r[3]),
      fat: Number(r[4]),
      fiber: Number(r[5]),
    },
    serving_g: Number(r[6]),
    piece_g: r[7] === null ? null : Number(r[7]),
    category: String(r[8]),
    tags: r[9] as string[],
    aliases: r[10] as string[],
    preparation: String(r[11]),
    source: "Test",
  })),
  templates: recipes.map((r) => ({
    id: r.slug,
    slug: r.slug,
    name: r.name,
    slots: r.slots,
    instructions: r.steps,
    cooking_minutes: r.prep + r.cook,
    complexity: r.skill,
    batch_friendly: r.cook > 0,
    items: r.items.map(([name, q, role]) => ({
      food_id: String(name),
      quantity_g: Number(q),
      role: role as "protein" | "carb" | "fat" | "fiber",
    })),
  })),
  targets: { calories: 2100, protein: 130, carbs: 250, fat: 64, fiber: 29 },
  preferences: {
    mealsPerDay: 3,
    restrictions: [],
    excluded: ["Peanuts"],
    disliked: [],
    preferred: [],
    cookingMinutes: 30,
    complexity: 2,
    prepFrequency: "weekly",
    repeatTolerance: "some",
    monthlyBudget: 300,
    currency: "USD",
  },
};
actualContext.optimization = {
  ...data,
  offers: actualContext.foods.flatMap((f, i) => [
    offer(`a-${f.id}`, f.id, "a", i % 2 ? 8 : 2, 500),
    offer(`b-${f.id}`, f.id, "b", i % 2 ? 2 : 8, 500),
  ]),
};
actualContext.pantry = actualContext.foods
  .slice(0, 10)
  .map((f) => ({
    food_id: f.id,
    quantity_g: 3000,
    expires_on: "2026-09-10",
  })) as PlanContext["pantry"];
describe("Phase 9 integration regressions", () => {
  it("uses the latest actual purchase date, preserves source/history, and rejects unknown locations and future dates", () => {
    const ref = offers[0];
    const observation = (
      id: string,
      date: string,
      price: number,
    ): PurchaseObservation => ({
      id,
      retail_product_id: ref.product.id,
      unit_price: price,
      created_at: "2026-09-07T00:00:00Z",
      purchase: {
        currency: "USD",
        store_location_id: ref.location.id,
        purchased_on: date,
        origin: "receipt",
      },
    });
    const rows = [
      observation("old", "2026-09-01", 20),
      observation("new", "2026-09-06", 7),
      observation("future", "2026-10-01", 1),
      {
        ...observation("unknown", "2026-09-07", 1),
        purchase: {
          currency: "USD",
          store_location_id: null,
          purchased_on: "2026-09-07",
          origin: "receipt",
        },
      },
    ];
    const merged = mergeObservedPrices(offers, rows, context.today);
    expect(merged[0].price).toBe(7);
    expect(merged[0].source).toBe("receipt");
    expect(merged[0].history).toHaveLength(2);
    expect(merged[1].source).toBe("demo");
    expect(
      compareCarts(requirements, { ...data, offers: merged }, "USD").single
        .total,
    ).toBe(10);
  });
  it.each([
    ["eggs", 400, 600, 600],
    ["yogurt", 794, 907, 907],
    ["bread", 400, 680, 680],
    ["bananas", 590, 118, 590],
    ["meat", 635, 454, 908],
    ["rice", 1400, 5000, 5000],
  ])(
    "keeps %s need separate from known purchase quantity",
    (name, need, size, expected) => {
      const result = choosePackages(
        { food_id: String(name), name: String(name), grams: Number(need) },
        [offer(String(name), String(name), "a", 5, Number(size))],
      )!;
      expect(result.requiredG).toBe(need);
      expect(result.grams).toBe(expected);
      expect(result.leftoverG).toBeCloseTo(Number(expected) - Number(need));
    },
  );
  it("does not invent a package weight", () => {
    expect(
      choosePackages(requirements[0], [
        {
          ...offers[0],
          product: { ...offers[0].product, package_grams: null },
        },
      ]),
    ).toBeNull();
  });
  it("travel costs and store limits change the chosen basket", () => {
    expect(
      compareCarts(
        requirements,
        { ...data, distancesKm: { a: 0, b: 20 }, travelCostPerKm: 1 },
        "USD",
      ).bestSplit.stores,
    ).toEqual(["a"]);
    expect(
      compareCarts(requirements, { ...data, maxStores: 1 }, "USD").bestSplit
        .stores,
    ).toHaveLength(1);
  });
  it("does not claim swap savings for a meal absent from the visible draft", () => {
    expect(
      smartSwapDelta({ ...meal, key: "absent" }, meal, days, context)
        .weekSavings,
    ).toBeNull();
  });
  it("accounts for only usable pantry and uses observed package pricing in discovery", () => {
    const c = {
      ...context,
      optimization: {
        ...data,
        offers: offers.map((o) => ({
          ...o,
          is_demo: false,
          source: "receipt" as const,
        })),
      },
      pantry: [
        { food_id: "eggs", quantity_g: 1000, expires_on: "2026-09-06" },
      ] as PlanContext["pantry"],
    };
    const result = estimateMeal(meal, c, true);
    expect(result.coverage).toBe(0);
    expect(result.cost).toBe(4);
    expect(result.isDemo).toBe(false);
  });
  it("changes meaningful plan choices with objective weights and stays reproducible", async () => {
    const outputs = await Promise.all(
      objectives.map((o) =>
        optimizePlan(actualContext, actualContext.today, 7, o),
      ),
    );
    const signatures = outputs.map((o) =>
      o.days.flatMap((d) => d.meals.map((m) => m.template_id)).join("|"),
    );
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < objectives.length; i++)
      for (const other of outputs)
        expect(outputs[i].summary.score).toBeLessThanOrEqual(
          scorePlan(other.days, actualContext, objectives[i]).score + 1e-8,
        );
    expect(
      (await optimizePlan(actualContext, actualContext.today, 7, "Balanced"))
        .days,
    ).toEqual(outputs[0].days);
    expect(
      outputs[0].days
        .flatMap((d) => d.meals.flatMap((m) => m.ingredients))
        .some((i) => i.name === "Peanut butter"),
    ).toBe(false);
  });
  it("ranks cheaper swaps by the whole draft and preserves dietary compatibility", async () => {
    const result = await optimizePlan(
      actualContext,
      actualContext.today,
      7,
      "Balanced",
    );
    const draft = { ...actualContext, days: result.days };
    const swaps = rankSwaps(draft, result.days[0].meals[0], "Cheaper");
    for (const s of swaps) {
      expect(s.smart!.weekSavings).toBeGreaterThan(0);
      expect(s.meal.ingredients.some((i) => i.name === "Peanut butter")).toBe(
        false,
      );
    }
    expect(swaps.map((s) => s.smart!.weekSavings)).toEqual(
      swaps.map((s) => s.smart!.weekSavings).sort((a, b) => b! - a!),
    );
  });
});
