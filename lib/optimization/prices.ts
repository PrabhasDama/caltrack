import type { Offer } from "./engine";
export type PurchaseObservation = {
  id: string;
  retail_product_id: string | null;
  unit_price: number | string;
  created_at: string;
  purchase: {
    currency: string;
    store_location_id: string | null;
    purchased_on: string;
    origin: string;
  };
};
/** Caller supplies only its own non-voided, actual package purchases. Never invent a location. */
export function mergeObservedPrices(
  reference: Offer[],
  observations: PurchaseObservation[],
  today: string,
): Offer[] {
  return reference.map((ref) => {
    const rows = observations
      .filter(
        (i) =>
          i.retail_product_id === ref.product.id &&
          i.purchase.store_location_id === ref.location.id &&
          i.purchase.currency === ref.currency &&
          i.purchase.purchased_on <= today &&
          Number.isFinite(Number(i.unit_price)) &&
          Number(i.unit_price) >= 0,
      )
      .sort(
        (a, b) =>
          b.purchase.purchased_on.localeCompare(a.purchase.purchased_on) ||
          b.created_at.localeCompare(a.created_at) ||
          a.id.localeCompare(b.id),
      );
    if (!rows.length) return ref;
    const latest = rows[0];
    return {
      ...ref,
      id: latest.id,
      price: Number(latest.unit_price),
      is_demo: false,
      promotion: null,
      provider: "Your purchase history",
      source: latest.purchase.origin === "receipt" ? "receipt" : "manual",
      observed_at: `${latest.purchase.purchased_on}T12:00:00Z`,
      history: rows.map((i) => ({
        price: Number(i.unit_price),
        observed_at: `${i.purchase.purchased_on}T12:00:00Z`,
      })),
    };
  });
}
