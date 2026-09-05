import type { Macros } from "@/lib/nutrition/macros";
import type { PriceObservation, Currency } from "./types";
export const money = (value: number, currency: Currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(value);
export function unitPrices(
  price: number,
  grams: number | null,
  servingGrams?: number,
  nutrition?: Macros,
) {
  if (
    !Number.isFinite(price) ||
    price < 0 ||
    !grams ||
    !Number.isFinite(grams) ||
    grams <= 0
  )
    return null;
  const perGram = price / grams;
  return {
    per100g: perGram * 100,
    perLb: perGram * 453.59237,
    perOz: perGram * 28.349523125,
    perServing:
      servingGrams && servingGrams > 0 ? perGram * servingGrams : null,
    per100Calories:
      nutrition && nutrition.calories > 0
        ? (price / ((nutrition.calories * grams) / 100)) * 100
        : null,
    per25gProtein:
      nutrition && nutrition.protein > 0
        ? (price / ((nutrition.protein * grams) / 100)) * 25
        : null,
  };
}
export function priceHistoryStats(
  history: PriceObservation[],
  currency: Currency,
  asOf: string,
  days = 30,
) {
  const end = new Date(asOf).valueOf();
  const observations = history
    .filter(
      (h) =>
        h.currency === currency && new Date(h.observed_at).valueOf() <= end,
    )
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  if (!observations.length) return null;
  const recent = observations.filter(
    (h) => new Date(h.observed_at).valueOf() >= end - days * 86400000,
  );
  return {
    current: observations.at(-1)!.price,
    recentAverage: recent.length
      ? recent.reduce((s, h) => s + h.price, 0) / recent.length
      : null,
    low: Math.min(...observations.map((h) => h.price)),
    high: Math.max(...observations.map((h) => h.price)),
    observations: observations.length,
  };
}
