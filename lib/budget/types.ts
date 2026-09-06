import type { Currency } from "@/lib/pricing/types";
export type PurchaseItem = {
  food_id: string | null;
  retail_product_id: string | null;
  name: string;
  quantity: number;
  unit: "g" | "kg" | "oz" | "lb" | "piece" | "serving" | "package";
  unit_price: number;
  price_source?: string;
  voided_at?: string | null;
};
export type Purchase = {
  id: string;
  store_id: string | null;
  store_name: string;
  purchased_on: string;
  currency: Currency;
  total: number;
  notes: string;
  updated_at: string;
  items: PurchaseItem[];
  origin?: string;
};
export type MonthSummary = {
  month: string;
  currency: Currency;
  total: number;
  purchase_count: number;
  shopping_days: number;
};
