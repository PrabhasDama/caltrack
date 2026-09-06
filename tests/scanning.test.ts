import { describe, it, expect } from "vitest";
import {
  normalizeReviewedLabel,
  matchReceiptName,
} from "@/lib/scanning/review";
import { labelProvider, receiptProvider } from "@/lib/scanning/providers";
import type { CatalogFood } from "@/lib/meal-plan/types";
const label = {
  name: "Reviewed snack",
  servingSize: 2,
  servingUnit: "pieces",
  servingGrams: 40,
  servingsPerContainer: 5,
  calories: 160,
  protein: 8,
  carbs: 20,
  fat: 5,
  fiber: 3,
  sugar: 4,
  sodium: 100,
  confirmed: true,
};
describe("assistive scanning review", () => {
  it("requires affirmative review before normalizing for save", () => {
    expect(() =>
      normalizeReviewedLabel({ ...label, confirmed: false }),
    ).toThrow();
    expect(() =>
      normalizeReviewedLabel({ ...label, confirmed: undefined }),
    ).toThrow();
  });
  it("converts reviewed per-serving amounts to canonical nutrition", () => {
    const d = normalizeReviewedLabel(label);
    expect(d.per100g.calories).toBe(400);
    expect(d.per100g.protein).toBe(20);
    expect(d.per100g.sodium).toBe(250);
  });
  it("preserves unknown optional values and rejects inconsistent serving weights", () => {
    expect(
      normalizeReviewedLabel({ ...label, sugar: null }).per100g.sugar,
    ).toBeNull();
    expect(() =>
      normalizeReviewedLabel({ ...label, servingUnit: "g", servingSize: 20 }),
    ).toThrow();
  });
  it("does not manufacture extraction results when no provider is configured", async () => {
    for (const p of [labelProvider, receiptProvider])
      expect(await p.extract(new Blob())).toMatchObject({
        status: "unavailable",
        candidate: null,
      });
  });
  it("matches abbreviations and identifies unknown lines without invented confidence", () => {
    const foods = [
      { id: "a", name: "Chicken breast", aliases: [] },
      { id: "b", name: "Eggs", aliases: [] },
    ] satisfies Pick<CatalogFood, "id" | "name" | "aliases">[];
    expect(matchReceiptName("CHKN BRST", foods, [], [])[0].food.id).toBe("a");
    expect(matchReceiptName("KIRK ORG EGGS", foods, [], ["b"])[0].state).toBe(
      "suggested",
    );
    expect(matchReceiptName("MYSTERY", foods, [], [])).toEqual([]);
  });
});
