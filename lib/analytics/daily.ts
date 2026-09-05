import { sumMacros } from "@/lib/nutrition/macros";
import type { DashboardData, WeightEntry } from "@/types/domain";
export function dailySummary(data: DashboardData) {
  const consumed = sumMacros([
    ...data.meals.filter((m) => m.status === "completed"),
    ...data.extras,
  ]);
  const workout = Boolean(
    data.workouts.find((w) => w.local_date === data.date),
  );
  const checks = {
    breakfast:
      data.log.breakfast ||
      data.meals.some(
        (m) => m.slot === "Breakfast" && m.status === "completed",
      ),
    lunch:
      data.log.lunch ||
      data.meals.some((m) => m.slot === "Lunch" && m.status === "completed"),
    dinner:
      data.log.dinner ||
      data.meals.some((m) => m.slot === "Dinner" && m.status === "completed"),
    protein: data.log.protein || consumed.protein >= data.targets.protein,
    fiber: data.log.fiber || consumed.fiber >= data.targets.fiber,
    workout,
    water: data.log.water_ml >= data.targets.water_ml,
    weight: data.weights.some((w) => w.local_date === data.date),
  };
  const total = data.log.rest_day ? 7 : 8;
  const completed = Object.entries(checks).filter(
    ([key, value]) => value && !(key === "workout" && data.log.rest_day),
  ).length;
  const status = data.log.rest_day
    ? "Rest day"
    : completed / total >= 0.75
      ? "On track"
      : completed === 0
        ? "A fresh start"
        : "Keep it going";
  return { consumed, checks, total, completed, status };
}
export function weightProgress(start: number, current: number, goal: number) {
  const distance = goal - start;
  if (distance === 0)
    return {
      percent: 100,
      change: current - start,
      remaining: Math.abs(current - goal),
    };
  return {
    percent: Math.max(0, Math.min(100, ((current - start) / distance) * 100)),
    change: current - start,
    remaining: Math.abs(current - goal),
  };
}
export function weeklyWeightAverages(
  entries: WeightEntry[],
  monday: (d: string) => string,
) {
  const groups = new Map<string, number[]>();
  for (const w of entries) {
    const week = monday(w.local_date);
    groups.set(week, [...(groups.get(week) || []), Number(w.weight_kg)]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, weights]) => ({
      week,
      average: weights.reduce((a, b) => a + b, 0) / weights.length,
      count: weights.length,
    }));
}
