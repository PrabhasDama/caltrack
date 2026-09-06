import { addDays, mondayOf } from "@/lib/date";
import { sumMacros, type Macros } from "@/lib/nutrition/macros";
import type { WeightEntry } from "@/types/domain";

const elapsed = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000,
  );
export function weightTrend(entries: WeightEntry[]) {
  const ordered = [...entries].sort((a, b) =>
    a.local_date.localeCompare(b.local_date),
  );
  return ordered.map((entry) => {
    const window = ordered.filter(
      (w) =>
        w.local_date <= entry.local_date &&
        w.local_date >= addDays(entry.local_date, -6),
    );
    return {
      ...entry,
      trend:
        window.reduce((sum, w) => sum + Number(w.weight_kg), 0) / window.length,
      samples: window.length,
    };
  });
}
export function weightTrajectory(
  entries: WeightEntry[],
  goal: number,
  today: string,
  maintenance = false,
) {
  const points = weightTrend(
    entries.filter(
      (w) => w.local_date >= addDays(today, -41) && w.local_date <= today,
    ),
  );
  const insufficient = {
    state: "Insufficient data",
    weeklyKg: null,
    eta: null,
    r2: null,
  } as const;
  if (
    points.length < 8 ||
    elapsed(points[0].local_date, points.at(-1)!.local_date) < 21 ||
    elapsed(points.at(-1)!.local_date, today) > 7
  )
    return insufficient;
  const xs = points.map((p) => elapsed(points[0].local_date, p.local_date));
  const ys = points.map((p) => p.trend);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length,
    my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const slope =
    xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) /
    xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const total = ys.reduce((s, y) => s + (y - my) ** 2, 0),
    residual = ys.reduce(
      (s, y, i) => s + (y - (my + slope * (xs[i] - mx))) ** 2,
      0,
    );
  const r2 = total ? Math.max(0, 1 - residual / total) : 0;
  const weeklyKg = slope * 7,
    remaining = goal - ys.at(-1)!;
  const stable = Math.abs(weeklyKg) < 0.1;
  const atGoal = Math.abs(remaining) <= 0.25;
  const toward = remaining * slope > 0;
  const days = slope ? remaining / slope : Infinity;
  const eta =
    !maintenance &&
    !atGoal &&
    toward &&
    !stable &&
    r2 >= 0.5 &&
    Math.sqrt(residual / points.length) <= 1 &&
    days > elapsed(points.at(-1)!.local_date, today) &&
    days <= 730
      ? addDays(points.at(-1)!.local_date, Math.ceil(days))
      : null;
  return {
    state: maintenance
      ? stable
        ? "On track"
        : "Needs attention"
      : atGoal
        ? "On track"
        : toward && !stable
          ? "Trending well"
          : "Needs attention",
    weeklyKg,
    eta,
    r2,
  };
}
export type NutritionLog = Macros & { local_date: string; status?: string };
export function nutritionDays(meals: NutritionLog[], extras: NutritionLog[]) {
  const dates = [
    ...new Set(
      [...meals.filter((m) => m.status === "completed"), ...extras].map(
        (m) => m.local_date,
      ),
    ),
  ].sort();
  return dates.map((date) => ({
    date,
    ...sumMacros(
      [
        ...meals.filter(
          (m) => m.local_date === date && m.status === "completed",
        ),
        ...extras.filter((e) => e.local_date === date),
      ].map((m) => ({
        calories: Number(m.calories),
        protein: Number(m.protein),
        carbs: Number(m.carbs),
        fat: Number(m.fat),
        fiber: Number(m.fiber),
      })),
    ),
  }));
}
export function weeklySummary(input: {
  today: string;
  week: string;
  targets: Macros;
  meals: NutritionLog[];
  extras: NutritionLog[];
  workouts: { local_date: string }[];
  weights: WeightEntry[];
  purchases: { purchased_on: string; total: number; currency: string }[];
  budget: number;
  currency: string;
  workoutTarget: number;
}) {
  const end = [addDays(input.week, 6), input.today].sort()[0];
  const inWeek = (date: string) => date >= input.week && date <= end;
  const days = nutritionDays(input.meals, input.extras).filter((d) =>
    inWeek(d.date),
  );
  const meals = input.meals.filter((m) => inWeek(m.local_date));
  const average = Object.fromEntries(
    (["calories", "protein", "carbs", "fat", "fiber"] as (keyof Macros)[]).map((k) => [
      k,
      days.length ? days.reduce((s, d) => s + d[k], 0) / days.length : null,
    ]),
  ) as Record<keyof Macros, number | null>;
  const hits = Object.fromEntries(
    (["calories", "protein", "carbs", "fat", "fiber"] as const).map((k) => [
      k,
      days.filter((d) =>
        ["protein", "fiber"].includes(k)
          ? d[k] >= input.targets[k] * 0.9
          : Math.abs(d[k] - input.targets[k]) <=
            input.targets[k] * (k === "calories" ? 0.1 : 0.2),
      ).length,
    ]),
  ) as Record<keyof Macros, number>;
  const span = Math.max(0, elapsed(input.week, end) + 1);
  const budgetPace = Array.from({ length: span }, (_, i) =>
    addDays(input.week, i),
  ).reduce((sum, date) => {
    const d = new Date(`${date}T12:00:00Z`);
    const monthDays = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    return sum + input.budget / monthDays;
  }, 0);
  const trends = weightTrend(input.weights).filter((w) => inWeek(w.local_date));
  return {
    start: input.week,
    end,
    span,
    trackedDays: days.length,
    average,
    hits,
    completed: meals.filter((m) => m.status === "completed").length,
    skipped: meals.filter((m) => m.status === "skipped").length,
    planned: meals.length,
    workouts: new Set(
      input.workouts
        .filter((w) => inWeek(w.local_date))
        .map((w) => w.local_date),
    ).size,
    workoutTarget: input.workoutTarget,
    weightDays: input.weights.filter((w) => inWeek(w.local_date)).length,
    weightChange:
      trends.length >= 2 ? trends.at(-1)!.trend - trends[0].trend : null,
    spend: input.purchases
      .filter((p) => inWeek(p.purchased_on) && p.currency === input.currency)
      .reduce((s, p) => s + Number(p.total), 0),
    budgetPace,
    nutritionState:
      days.length < 3
        ? "Insufficient data"
        : hits.calories / days.length >= 0.7 &&
            hits.protein / days.length >= 0.7
          ? "On track"
          : "Needs attention",
  };
}
export function plateauState(
  entries: WeightEntry[],
  today: string,
  trackedDays: string[],
) {
  const first = addDays(today, -20);
  const recent = [...entries]
    .sort((a, b) => a.local_date.localeCompare(b.local_date))
    .filter((w) => w.local_date >= first && w.local_date <= today);
  const weeks = new Set(recent.map((w) => mondayOf(w.local_date)));
  const adequate =
    recent.length >= 9 &&
    weeks.size >= 3 &&
    elapsed(
      recent[0]?.local_date || today,
      recent.at(-1)?.local_date || today,
    ) >= 18 &&
    new Set(trackedDays.filter((d) => d >= first && d <= today)).size >= 7;
  if (!adequate) return "insufficient" as const;
  const trend = weightTrend(recent);
  const change = trend.at(-1)!.trend - trend[0].trend;
  return Math.abs(change) <= 0.3 ? ("stable" as const) : ("changing" as const);
}
export const measurementNames = [
  "waist",
  "chest",
  "hips",
  "arms",
  "thighs",
] as const;
export type MeasurementName = (typeof measurementNames)[number];
export type BodyMeasurement = {
  id: string;
  local_date: string;
  updated_at: string;
  notes: string;
} & Record<MeasurementName, number | null>;
export const measurementToCm = (value: number, units: "imperial" | "metric") =>
  units === "imperial" ? value * 2.54 : value;
export const measurementFromCm = (
  value: number,
  units: "imperial" | "metric",
) => (units === "imperial" ? value / 2.54 : value);
