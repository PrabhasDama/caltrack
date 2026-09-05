import { describe, it, expect } from "vitest";
import {
  lineTotal,
  purchaseSubtotal,
  budgetNumbers,
  budgetSummary,
} from "@/lib/budget/calculations";
import { unitPrices, priceHistoryStats } from "@/lib/pricing/calculations";
import { DemoPriceProvider } from "@/lib/pricing/providers/demo";
import type { StoreOffer } from "@/lib/pricing/types";
const nutrition = { calories: 200, protein: 20, carbs: 20, fat: 5, fiber: 3 };
describe("receipt math and currency boundaries", () => {
  it("rounds each receipt line before adding the subtotal", () => {
    expect(lineTotal(1.5, 3.99)).toBe(5.99);
    expect(
      purchaseSubtotal([
        { quantity: 1.5, unit_price: 3.99 },
        { quantity: 2, unit_price: 1.01 },
      ]),
    ).toBe(8.01);
  });
  it("filters the month and currency without pretending an exchange rate", () => {
    const r = budgetNumbers(
      100,
      [
        { purchased_on: "2026-09-01", total: 20, currency: "USD" },
        { purchased_on: "2026-09-02", total: 30, currency: "CAD" },
        { purchased_on: "2026-08-01", total: 90, currency: "USD" },
      ],
      "2026-09",
      "2026-09-10",
      "USD",
    );
    expect(r.spent).toBe(20);
    expect(r.remaining).toBe(80);
    expect(r.projected).toBeNull();
  });
  it("projects only with enough dates in the current month", () => {
    expect(budgetSummary(200, 100, 2, "2026-09", "2026-09-10").projected).toBe(
      300,
    );
    expect(
      budgetSummary(200, 100, 2, "2026-09", "2026-09-05").projected,
    ).toBeNull();
    expect(
      budgetSummary(200, 100, 2, "2026-08", "2026-09-10").projected,
    ).toBeNull();
  });
  it("reports overspending as a negative remaining amount", () => {
    expect(budgetSummary(100, 125, 1, "2026-09", "2026-09-10")).toMatchObject({
      remaining: -25,
      percent: 100,
    });
  });
});
describe("known weights and nutrition only", () => {
  it("computes mass unit prices from package grams", () => {
    const p = unitPrices(10, 1000)!;
    expect(p.per100g).toBe(1);
    expect(p.perLb).toBeCloseTo(4.5359237);
    expect(p.perOz).toBeCloseTo(0.28349523125);
  });
  it("computes serving, calorie, and protein cost from actual item price", () => {
    expect(unitPrices(10, 1000, 50, nutrition)).toMatchObject({
      perServing: 0.5,
      per100Calories: 0.5,
      per25gProtein: 1.25,
    });
  });
  it("does not invent missing conversion or zero-nutrition metrics", () => {
    expect(unitPrices(10, null)).toBeNull();
    expect(unitPrices(10, 0)).toBeNull();
    expect(
      unitPrices(10, 1000, undefined, {
        ...nutrition,
        calories: 0,
        protein: 0,
      }),
    ).toMatchObject({
      perServing: null,
      per100Calories: null,
      per25gProtein: null,
    });
  });
});
describe("observed prices", () => {
  it("separates currencies, excludes future observations, and scopes the recent average", () => {
    const rows = [
      ["2026-07-01", 5, "USD"],
      ["2026-08-15", 10, "USD"],
      ["2026-09-01", 12, "USD"],
      ["2026-09-03", 100, "CAD"],
      ["2026-09-10", 1, "USD"],
    ].map(([d, p, c], i) => ({
      id: String(i),
      offer_id: "o",
      observed_at: `${d}T12:00:00Z`,
      price: Number(p),
      currency: c as "USD" | "CAD",
    }));
    expect(priceHistoryStats(rows, "USD", "2026-09-05T12:00:00Z")).toEqual({
      current: 12,
      recentAverage: 11,
      low: 5,
      high: 12,
      observations: 3,
    });
    expect(priceHistoryStats([], "USD", "2026-09-05")).toBeNull();
  });
  it("labels demo offers and rejects misrepresented live data", async () => {
    const offer: StoreOffer = {
      id: "o",
      product: {
        id: "p",
        food_id: "f",
        name: "Demo rice",
        package_amount: 1,
        package_unit: "kg",
        package_grams: 1000,
      },
      location: {
        id: "l",
        store_id: "s",
        name: "Illustrative location",
        country_code: "US",
        currency: "USD",
        is_demo: true,
      },
      price: 3,
      currency: "USD",
      observed_at: "2026-09-05",
      provider: "demo",
      is_demo: true,
      promotion: null,
    };
    const p = new DemoPriceProvider([offer]);
    expect(p.isDemo).toBe(true);
    expect(await p.getOffers(["f"], "CAD")).toEqual([]);
    expect(await p.getOffers(["f"], "USD")).toHaveLength(1);
    expect(() => new DemoPriceProvider([{ ...offer, is_demo: false }])).toThrow(
      "simulated",
    );
    expect(await p.getProductPrice("missing", "l")).toBeNull();
  });
});
