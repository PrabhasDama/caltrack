import type { Currency } from "@/lib/pricing/types";
export function lineTotal(quantity: number, unitPrice: number) {
  return Math.round(quantity * unitPrice * 100) / 100;
}
export function purchaseSubtotal(
  items: { quantity: number; unit_price: number }[],
) {
  return (
    Math.round(
      items.reduce((sum, i) => sum + lineTotal(i.quantity, i.unit_price), 0) *
        100,
    ) / 100
  );
}
export function budgetNumbers(
  budget: number,
  purchases: { purchased_on: string; total: number; currency: Currency }[],
  month: string,
  today: string,
  currency: Currency,
) {
  const current = purchases.filter(
    (p) => p.purchased_on.startsWith(month) && p.currency === currency,
  );
  const spent =
    Math.round(current.reduce((s, p) => s + Number(p.total), 0) * 100) / 100;
  const elapsed = Number(today.slice(8, 10));
  const monthDays = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  const enough =
    month === today.slice(0, 7) &&
    elapsed >= 7 &&
    new Set(current.map((p) => p.purchased_on)).size >= 2;
  return {
    spent,
    remaining: Math.round((budget - spent) * 100) / 100,
    percent: budget > 0 ? Math.min(100, (spent / budget) * 100) : 0,
    projected: enough
      ? Math.round((spent / elapsed) * monthDays * 100) / 100
      : null,
    count: current.length,
  };
}

export function budgetSummary(
  budget: number,
  spent: number,
  shoppingDays: number,
  month: string,
  today: string,
) {
  const elapsed = Number(today.slice(8, 10));
  const days = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  return {
    spent,
    remaining: Math.round((budget - spent) * 100) / 100,
    percent: Math.min(100, (spent / budget) * 100),
    projected:
      month === today.slice(0, 7) && elapsed >= 7 && shoppingDays >= 2
        ? Math.round((spent / elapsed) * days * 100) / 100
        : null,
  };
}
