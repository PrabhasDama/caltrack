import { describe, it, expect } from "vitest";
import {
  quantityToGrams,
  gramsToQuantity,
  unitGrams,
} from "@/lib/pantry/units";
import {
  subtractPantry,
  usableQuantity,
  type PantryRecord,
} from "@/lib/pantry/inventory";
import { groceryRequirements } from "@/lib/groceries/requirements";
const stock: PantryRecord = {
  id: "p",
  food_id: "rice",
  quantity_g: 300,
  low_threshold_g: 50,
  display_unit: "g",
  purchased_on: null,
  expires_on: null,
  updated_at: "now",
};
describe("inventory quantities", () => {
  it("normalizes grams, kilograms, ounces, and pounds", () => {
    expect(quantityToGrams(1, "kg")).toBe(1000);
    expect(quantityToGrams(1, "lb")).toBeCloseTo(453.592, 3);
    expect(quantityToGrams(16, "oz")).toBeCloseTo(quantityToGrams(1, "lb"), 3);
    expect(gramsToQuantity(1000, "kg")).toBe(1);
  });
  it("converts pieces only with a known mass", () => {
    expect(quantityToGrams(2, "piece", { piece_g: 50, serving_g: 50 })).toBe(
      100,
    );
    expect(() => unitGrams("piece")).toThrow("No reliable");
    expect(() => quantityToGrams(-1, "kg")).toThrow();
  });
  it("records actual pantry usage without going below zero", () => {
    expect(subtractPantry(50, 100)).toEqual({ remaining: 0, deducted: 50 });
    expect(subtractPantry(100, 30)).toEqual({ remaining: 70, deducted: 30 });
  });
  it("excludes inventory expired before the consumption period ends", () => {
    expect(
      usableQuantity({ ...stock, expires_on: "2026-09-05" }, "2026-09-06"),
    ).toBe(0);
    expect(
      usableQuantity({ ...stock, expires_on: "2026-09-06" }, "2026-09-06"),
    ).toBe(300);
  });
  it("aggregates only uneaten requirements and subtracts inventory once", () => {
    const result = groceryRequirements(
      [
        {
          status: "planned",
          ingredients: [{ food_id: "rice", quantity_g: 250 }],
        },
        {
          status: "planned",
          ingredients: [{ food_id: "rice", quantity_g: 200 }],
        },
        {
          status: "completed",
          ingredients: [{ food_id: "rice", quantity_g: 100 }],
        },
      ],
      [stock],
      "2026-09-06",
    );
    expect(result).toEqual([
      { food_id: "rice", required_g: 450, pantry_g: 300, amount: 150 },
    ]);
  });
  it("never recommends a negative shopping amount", () => {
    expect(
      groceryRequirements(
        [
          {
            status: "planned",
            ingredients: [{ food_id: "rice", quantity_g: 100 }],
          },
        ],
        [stock],
        "2026-09-06",
      )[0].amount,
    ).toBe(0);
  });
});
