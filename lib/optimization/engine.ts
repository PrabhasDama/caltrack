import type { PlanContext, PlanDay, PlannedMeal } from "@/lib/meal-plan/types";
import type { StoreOffer } from "@/lib/pricing/types";
import { generatePlan, targetLoss } from "@/lib/meal-plan/generator";
import { dayMacros } from "@/lib/meal-plan/calculations";
import { addDays } from "@/lib/date";
export const objectives = [
  "Balanced",
  "Lowest Cost",
  "Best Macro Fit",
  "Pantry First",
  "Fewest Stores",
  "Variety",
] as const;
export type Objective = (typeof objectives)[number];
export type PriceClass =
  "provider" | "observed" | "manual" | "receipt" | "demo";
export type Offer = StoreOffer & {
  source: PriceClass;
  history?: { price: number; observed_at: string }[];
};
export type OptimizationData = {
  offers: Offer[];
  spent: number;
  shoppingDays: number;
  preferredStores: string[];
  distancesKm: Record<string, number>;
  maxStores: number;
  extraStorePenalty: number;
  travelCostPerKm: number;
};
export type Requirement = { food_id: string; name: string; grams: number };
export type CartLine = {
  food_id: string;
  name: string;
  requiredG: number;
  grams: number;
  leftoverG: number;
  cost: number;
  packages: { offer: Offer; count: number }[];
};
export type Cart = {
  id: string;
  lines: CartLine[];
  missing: Requirement[];
  subtotal: number;
  total: number | null;
  stores: string[];
  travel: number;
  distanceKnown: boolean;
  score: number;
};
const round = (n: number) => Math.round(n * 100) / 100;
export const weights: Record<
  Objective,
  {
    nutrition: number;
    cost: number;
    pantry: number;
    stores: number;
    variety: number;
    expiry: number;
  }
> = {
  Balanced: {
    nutrition: 4,
    cost: 3,
    pantry: 2,
    stores: 1,
    variety: 2,
    expiry: 1,
  },
  "Lowest Cost": {
    nutrition: 2,
    cost: 9,
    pantry: 1,
    stores: 0.2,
    variety: 1,
    expiry: 1,
  },
  "Best Macro Fit": {
    nutrition: 12,
    cost: 1,
    pantry: 1,
    stores: 0.2,
    variety: 1,
    expiry: 0.5,
  },
  "Pantry First": {
    nutrition: 3,
    cost: 2,
    pantry: 10,
    stores: 1,
    variety: 1,
    expiry: 3,
  },
  "Fewest Stores": {
    nutrition: 3,
    cost: 2,
    pantry: 2,
    stores: 10,
    variety: 1,
    expiry: 1,
  },
  Variety: {
    nutrition: 3,
    cost: 2,
    pantry: 1,
    stores: 0.5,
    variety: 12,
    expiry: 1,
  },
};
/** Allocate actual stock once, chronologically; expiry never covers a later meal. */
export function planRequirements(
  days: PlanDay[],
  context: Pick<PlanContext, "pantry" | "today">,
) {
  const stock = new Map(
    (context.pantry || []).map((p) => [
      p.food_id,
      { ...p, quantity_g: Number(p.quantity_g) },
    ]),
  );
  const needed = new Map<string, Requirement>();
  let total = 0,
    covered = 0,
    expiring = 0;
  const runout = new Map<string, string>();
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date)))
    for (const m of d.meals.filter((m) => !m.status || m.status === "planned"))
      for (const i of m.ingredients) {
        const p = stock.get(i.food_id),
          valid =
            p &&
            (!p.expires_on || p.expires_on >= d.date) &&
            d.date >= context.today;
        const used = valid ? Math.min(p.quantity_g, i.quantity_g) : 0;
        if (p) p.quantity_g -= used;
        total += i.quantity_g;
        covered += used;
        if (used && p?.expires_on && p.expires_on <= addDays(context.today, 3))
          expiring += used;
        const missing = i.quantity_g - used;
        if (missing > 0.0001) {
          const prior = needed.get(i.food_id);
          needed.set(i.food_id, {
            food_id: i.food_id,
            name: i.name,
            grams: (prior?.grams || 0) + missing,
          });
          if (!runout.has(i.food_id)) runout.set(i.food_id, d.date);
        }
      }
  return {
    requirements: [...needed.values()].sort((a, b) =>
      a.food_id.localeCompare(b.food_id),
    ),
    coverage: total ? covered / total : 0,
    expiringCoverage: total ? expiring / total : 0,
    runout: [...runout].map(([food_id, date]) => ({ food_id, date })),
    totalG: total,
    coveredG: covered,
  };
}
/** Bounded one/two-product combinations; smallest sufficient weight, then price. */
export function choosePackages(
  need: Requirement,
  offers: Offer[],
): CartLine | null {
  const available = offers
    .filter(
      (o) =>
        o.product.food_id === need.food_id &&
        o.product.is_active !== false &&
        Number.isFinite(o.price) &&
        o.price >= 0 &&
        o.product.package_grams &&
        o.product.package_grams > 0,
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 12);
  let best: CartLine | null = null;
  function consider(packages: { offer: Offer; count: number }[]) {
    const grams = packages.reduce(
      (n, p) => n + p.offer.product.package_grams! * p.count,
      0,
    );
    if (grams + 0.0001 < need.grams) return;
    const cost = round(
      packages.reduce((n, p) => n + p.offer.price * p.count, 0),
    );
    if (
      !best ||
      grams < best.grams - 0.0001 ||
      (Math.abs(grams - best.grams) < 0.0001 && cost < best.cost)
    )
      best = {
        food_id: need.food_id,
        name: need.name,
        requiredG: need.grams,
        grams,
        leftoverG: Math.max(0, grams - need.grams),
        cost,
        packages,
      };
  }
  for (const a of available) {
    consider([
      { offer: a, count: Math.ceil(need.grams / a.product.package_grams!) },
    ]);
    for (const b of available.filter((b) => b.id > a.id))
      for (
        let n = 1;
        n <= Math.min(32, Math.ceil(need.grams / a.product.package_grams!));
        n++
      ) {
        const rest = Math.max(0, need.grams - n * a.product.package_grams!);
        consider([
          { offer: a, count: n },
          ...(rest
            ? [{ offer: b, count: Math.ceil(rest / b.product.package_grams!) }]
            : []),
        ]);
      }
  }
  return best;
}
export function compareCarts(
  requirements: Requirement[],
  data: OptimizationData,
  currency: string,
) {
  const offers = data.offers.filter((o) => o.currency === currency);
  const ids = [...new Set(offers.map((o) => o.location.id))]
    .sort()
    .slice(0, 10);
  const groups: string[][] = ids.map((id) => [id]);
  const max = Math.max(1, Math.min(3, data.maxStores));
  if (max >= 2)
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++) {
        groups.push([ids[a], ids[b]]);
        if (max >= 3)
          for (let c = b + 1; c < ids.length; c++)
            groups.push([ids[a], ids[b], ids[c]]);
      }
  if (!groups.length) groups.push([]);
  const carts: Cart[] = groups.map((locations) => {
    const lines: CartLine[] = [],
      missing: Requirement[] = [];
    for (const r of requirements) {
      const line = choosePackages(
        r,
        offers.filter((o) => locations.includes(o.location.id)),
      );
      if (line) lines.push(line);
      else missing.push(r);
    }
    const stores = [
      ...new Set(
        lines.flatMap((l) => l.packages.map((p) => p.offer.location.id)),
      ),
    ].sort();
    const subtotal = round(lines.reduce((s, l) => s + l.cost, 0));
    const distanceKnown = stores.every((s) =>
      Number.isFinite(data.distancesKm[s]),
    );
    const travel = round(
      stores.reduce(
        (s, id) => s + (data.distancesKm[id] || 0) * 2 * data.travelCostPerKm,
        0,
      ),
    );
    return {
      id: locations.join(":"),
      lines,
      missing,
      stores,
      subtotal,
      total: missing.length ? null : subtotal,
      travel,
      distanceKnown,
      score:
        subtotal +
        travel +
        Math.max(0, stores.length - 1) * data.extraStorePenalty,
    };
  });
  const completeFirst = (a: Cart, b: Cart) =>
    a.missing.length - b.missing.length;
  const cost = (a: Cart, b: Cart) =>
    completeFirst(a, b) ||
    a.subtotal - b.subtotal ||
    a.stores.length - b.stores.length ||
    a.id.localeCompare(b.id);
  const single =
    [...carts].filter((c) => c.stores.length <= 1).sort(cost)[0] || carts[0];
  const bestSplit = [...carts].sort(
    (a, b) => completeFirst(a, b) || a.score - b.score || cost(a, b),
  )[0];
  const fewest = [...carts].sort(
    (a, b) =>
      completeFirst(a, b) || a.stores.length - b.stores.length || cost(a, b),
  )[0];
  const preferred = carts
    .filter(
      (c) =>
        c.stores.length === 1 &&
        c.lines.some((l) =>
          l.packages.some((p) =>
            data.preferredStores.includes(p.offer.location.store_id),
          ),
        ),
    )
    .sort(cost)[0];
  const baseline = preferred || single;
  return {
    single,
    bestSplit,
    fewest,
    baseline,
    savings:
      baseline.total !== null && bestSplit.total !== null
        ? round(baseline.total - bestSplit.total)
        : null,
    options: carts.length,
  };
}
export function scorePlan(
  days: PlanDay[],
  context: PlanContext,
  objective: Objective,
) {
  const pantry = planRequirements(days, context);
  const data = context.optimization;
  const carts = data
    ? compareCarts(pantry.requirements, data, context.preferences.currency)
    : null;
  const cart = objective === "Fewest Stores" ? carts?.fewest : carts?.bestSplit;
  const meals = days.flatMap((d) => d.meals);
  const unique = new Set(meals.map((m) => m.template_id)).size;
  const remaining = data
    ? context.preferences.monthlyBudget - data.spent
    : context.preferences.monthlyBudget;
  const end = new Date(`${context.today}T12:00:00Z`);
  const daysLeft =
    new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
    ).getUTCDate() -
    end.getUTCDate() +
    1;
  const allowance =
    (Math.max(0, remaining) * Math.min(days.length, daysLeft)) / daysLeft;
  const nutritionLoss = days.length
    ? days.reduce((s, d) => s + targetLoss(dayMacros(d), context.targets), 0) /
      days.length
    : 0;
  const repeat = meals.length ? 1 - unique / meals.length : 0;
  const recent = new Set([
    ...(context.recentTemplateIds || []),
    ...context.days.flatMap((d) => d.meals.map((m) => m.template_id)),
  ]);
  const recentPenalty = meals.length
    ? meals.filter((m) => recent.has(m.template_id)).length / meals.length
    : 0;
  const w = weights[objective];
  const costRatio = cart ? cart.subtotal / Math.max(1, allowance) : 0;
  const score =
    w.nutrition * nutritionLoss +
    w.cost * costRatio +
    w.pantry * (1 - pantry.coverage) +
    w.stores * Math.max(0, (cart?.stores.length || 0) - 1) +
    w.variety * (repeat + recentPenalty * 0.2) -
    w.expiry * pantry.expiringCoverage +
    (cart?.missing.length || 0) * 25;
  return {
    score,
    pantry,
    carts,
    cart,
    remaining,
    allowance,
    nutritionFit: Math.round(100 / (1 + nutritionLoss)),
    variety: unique,
    estimatedSpend: cart?.total ?? null,
    projectedMonth:
      data && data.shoppingDays >= 2 && end.getUTCDate() >= 7
        ? round(
            (data.spent / end.getUTCDate()) *
              new Date(
                Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
              ).getUTCDate(),
          )
        : null,
  };
}
/** Search twelve reproducible, preference-safe plans; not a claim of global optimality. */
export async function optimizePlan(
  context: PlanContext,
  start: string,
  count: number,
  objective: Objective,
  variation = 0,
) {
  const candidates = [];
  for (let i = 0; i < 12; i++) {
    // Yield between bounded candidates so the pending state and navigation can paint.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const candidateContext =
      i < 6
        ? context
        : {
            ...context,
            preferences: { ...context.preferences, repeatTolerance: "variety" },
          };
    const days = generatePlan(
      candidateContext,
      start,
      count,
      variation + (i % 6),
    ).map((d) => {
      const old = context.days.find((x) => x.date === d.date);
      return old?.meals.some((m) => m.status && m.status !== "planned")
        ? old
        : d;
    });
    const horizon = [
      ...context.days.filter(
        (d) =>
          d.date >= context.today &&
          d.date <= addDays(context.today, 6) &&
          !days.some((n) => n.date === d.date),
      ),
      ...days,
    ];
    candidates.push({
      days,
      summary: scorePlan(horizon, context, objective),
      candidate: i,
    });
  }
  return candidates.sort(
    (a, b) => a.summary.score - b.summary.score || a.candidate - b.candidate,
  )[0];
}
export function smartSwapDelta(
  current: PlannedMeal,
  proposed: PlannedMeal,
  days: PlanDay[],
  context: PlanContext,
) {
  const replaced = days.map((d) => ({
    ...d,
    meals: d.meals.map((m) => (m.key === current.key ? proposed : m)),
  }));
  const hasCurrent = days.some((d) =>
    d.meals.some((m) => m.key === current.key),
  );
  const before = hasCurrent
      ? scorePlan(days, context, "Balanced").estimatedSpend
      : null,
    after = scorePlan(replaced, context, "Balanced").estimatedSpend;
  return {
    weekSavings:
      before !== null && after !== null ? round(before - after) : null,
    macros: Object.fromEntries(
      (["calories", "protein", "carbs", "fat"] as const).map((k) => [
        k,
        round(proposed.macros[k] - current.macros[k]),
      ]),
    ),
  };
}
export function priceQuality(offer: Offer, today: string) {
  const rows = (offer.history || []).filter(
    (h) =>
      h.observed_at.slice(0, 10) >= addDays(today, -30) &&
      h.observed_at.slice(0, 10) <= today,
  );
  const age = Math.floor(
    (new Date(`${today}T00:00:00Z`).getTime() -
      new Date(offer.observed_at).getTime()) /
      86400000,
  );
  if (new Set(rows.map((h) => h.observed_at.slice(0, 10))).size < 3)
    return {
      status:
        offer.source === "demo"
          ? "Demo / sample"
          : age > 14
            ? "Older observation"
            : "Observed price",
      average: null,
      low: null,
      high: null,
    };
  const average = rows.reduce((s, r) => s + r.price, 0) / rows.length;
  return {
    status: `${offer.source === "demo" ? "Demo history · " : ""}${offer.price < average * 0.95 ? "Good" : offer.price > average * 1.05 ? "High" : "Normal"}`,
    average: round(average),
    low: Math.min(...rows.map((r) => r.price)),
    high: Math.max(...rows.map((r) => r.price)),
  };
}
