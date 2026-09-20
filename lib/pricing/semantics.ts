import { money } from "./calculations";
import type { Currency } from "./types";
export type PriceInput = {
  price: number | null;
  currency: Currency;
  source: string;
  observedAt?: string | null;
  environment?: string | null;
  regularPrice?: number | null;
  available?: string | null;
};
export function priceMeaning(
  p: PriceInput,
  now = Date.now(),
  thresholds = { currentMs: 3600000, recentMs: 86400000 },
) {
  const valid = p.price !== null && Number.isFinite(p.price) && p.price >= 0;
  if (!valid)
    return {
      state: "unavailable",
      amount: "Price unavailable",
      label: "Price unavailable",
      eligible: false,
    };
  const amount = money(p.price!, p.currency);
  if (p.source === "demo")
    return { state: "demo", amount, label: "DEMO PRICE", eligible: true };
  if (p.environment === "certification")
    return {
      state: "confirmation",
      amount,
      label: "Certification price · needs confirmation",
      eligible: false,
    };
  const age = now - Date.parse(p.observedAt || "");
  const state =
    !Number.isFinite(age) || age < -60000 || age > thresholds.recentMs
      ? "stale"
      : age <= thresholds.currentMs
        ? "current"
        : "recent";
  const provider = p.source === "provider";
  return {
    state,
    amount,
    label:
      state === "stale"
        ? "Price outdated"
        : provider
          ? state === "current"
            ? "Current provider price"
            : "Recently observed provider price"
          : "Last confirmed price",
    eligible: state !== "stale" && p.available !== "out_of_stock",
  };
}
