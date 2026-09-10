import type {
  Currency,
  RetailProduct,
  StoreLocation,
} from "@/lib/pricing/types";
export type ShoppingEvent = {
  id: string;
  item_id: string | null;
  state: "purchased" | "voided";
  added_g: number;
  purchase_item_id: string;
  line: {
    name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    price_source: string;
  };
};
export type ShoppingSession = {
  id: string;
  status: "open" | "finished";
  location_id: string | null;
  purchase_id: string;
  receipt: {
    store_name: string;
    currency: Currency;
    total: number;
    purchased_on: string;
  };
  events: ShoppingEvent[];
};
export type ShoppingContext = {
  splits?: import("./splits").SplitPlan[];
  units: "imperial" | "metric";
  session: ShoppingSession | null;
  recentSessions: ShoppingSession[];
  stores: { id: string; name: string }[];
  locations: StoreLocation[];
  products: RetailProduct[];
  offers: import("@/lib/optimization/engine").Offer[];
  preferredStores?: string[];
  currency: Currency;
};
