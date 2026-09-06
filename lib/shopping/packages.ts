import type { RetailProduct } from "@/lib/pricing/types";
/** Minimize purchased weight at or above need; package count breaks ties. No price/store optimization. */
export function packageCombination(
  requiredG: number,
  products: RetailProduct[],
) {
  if (!Number.isFinite(requiredG) || requiredG < 0)
    throw new Error("Invalid requirement");
  const valid = products
    .filter((p) => p.package_grams && p.package_grams > 0)
    .slice(0, 20)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!valid.length || requiredG === 0) return null;
  // Bounded integer dynamic programming in whole grams. Reject fractional-weight packages instead of rounding food mass.
  const candidates = valid.filter((p) => Number.isInteger(p.package_grams));
  if (!candidates.length) return null;
  const limit =
    Math.ceil(requiredG) + Math.max(...candidates.map((p) => p.package_grams!));
  if (limit > 100000) return smallestSingle(requiredG, valid);
  const states = new Map<number, { count: number; quantities: number[] }>();
  states.set(0, { count: 0, quantities: candidates.map(() => 0) });
  for (let g = 0; g < Math.ceil(requiredG); g++) {
    const state = states.get(g);
    if (!state) continue;
    for (let i = 0; i < candidates.length; i++) {
      const next = g + candidates[i].package_grams!;
      if (next > limit) continue;
      const old = states.get(next);
      if (!old || old.count > state.count + 1) {
        const q = [...state.quantities];
        q[i]++;
        states.set(next, { count: state.count + 1, quantities: q });
      }
    }
  }
  const best = [...states.entries()]
    .filter(([g]) => g >= requiredG)
    .sort((a, b) => a[0] - b[0] || a[1].count - b[1].count)[0];
  if (!best) return null;
  return {
    grams: best[0],
    leftoverG: best[0] - requiredG,
    packages: best[1].quantities.flatMap((quantity, i) =>
      quantity ? [{ product: candidates[i], quantity }] : [],
    ),
  };
}
export function smallestSingle(requiredG: number, products: RetailProduct[]) {
  const p = products
    .filter((p) => p.package_grams && p.package_grams > 0)
    .map((product) => ({
      product,
      quantity: Math.ceil(requiredG / product.package_grams!),
    }))
    .sort(
      (a, b) =>
        a.quantity * a.product.package_grams! -
          b.quantity * b.product.package_grams! ||
        a.quantity - b.quantity ||
        a.product.id.localeCompare(b.product.id),
    )[0];
  return p
    ? {
        grams: p.quantity * p.product.package_grams!,
        leftoverG: p.quantity * p.product.package_grams! - requiredG,
        packages: [p],
      }
    : null;
}
