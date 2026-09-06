import { usableQuantity, type PantryRecord } from "@/lib/pantry/inventory";
export type IngredientRequirement = {
  food_id: string;
  required_g: number;
  pantry_g: number;
  amount: number;
};
export function groceryRequirements(
  meals: {
    status: string;
    ingredients: { food_id: string; quantity_g: number }[];
  }[],
  pantry: PantryRecord[],
  throughDate: string,
): IngredientRequirement[] {
  const totals = new Map<string, number>();
  for (const m of meals.filter((m) => m.status === "planned"))
    for (const i of m.ingredients) {
      if (!Number.isFinite(i.quantity_g) || i.quantity_g <= 0)
        throw new Error("Invalid ingredient amount.");
      totals.set(i.food_id, (totals.get(i.food_id) || 0) + i.quantity_g);
    }
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([food_id, required_g]) => {
      const stock = pantry.find((p) => p.food_id === food_id);
      const pantry_g = stock ? usableQuantity(stock, throughDate) : 0;
      return {
        food_id,
        required_g,
        pantry_g,
        amount: Math.max(0, required_g - pantry_g),
      };
    });
}
export type ShoppingItem = {
  id: string;
  food_id: string | null;
  name: string;
  required_g: number | null;
  pantry_g: number | null;
  amount: number;
  unit: string;
  source: "generated" | "manual";
  purchased: boolean;
  fulfillment?: "needed" | "purchased" | "already_have";
  updated_at: string;
};
