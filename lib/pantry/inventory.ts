export type PantryRecord = {
  id: string;
  food_id: string;
  quantity_g: number;
  low_threshold_g: number;
  display_unit: "g" | "kg" | "oz" | "lb" | "piece" | "serving";
  purchased_on: string | null;
  expires_on: string | null;
  updated_at: string;
};
export function usableQuantity(
  item: Pick<PantryRecord, "quantity_g" | "expires_on">,
  throughDate: string,
) {
  return item.expires_on && item.expires_on < throughDate ? 0 : item.quantity_g;
}
export function pantryState(item: PantryRecord, today: string) {
  return item.quantity_g === 0
    ? "Depleted"
    : item.expires_on && item.expires_on < today
      ? "Expired"
      : item.quantity_g <= item.low_threshold_g
        ? "Running low"
        : "In stock";
}
export function subtractPantry(stock: number, used: number) {
  if (
    !Number.isFinite(stock) ||
    !Number.isFinite(used) ||
    stock < 0 ||
    used < 0
  )
    throw new Error("Invalid inventory quantity.");
  const deducted = Math.min(stock, used);
  return { remaining: stock - deducted, deducted };
}
