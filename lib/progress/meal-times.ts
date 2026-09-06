import { addDays, mondayOf } from "@/lib/date";
export type TimedMeal = {
  status?: string;
  slot?: string;
  completed_at?: string | null;
};
export function timeParts(timestamp: string, timezone: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const v = (name: string) => p.find((p) => p.type === name)!.value;
  return {
    date: `${v("year")}-${v("month")}-${v("day")}`,
    minutes: Number(v("hour")) * 60 + Number(v("minute")),
  };
}
export function clockLabel(minutes: number) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "AM" : "PM"}`;
}
function distribution(values: number[]) {
  if (values.length < 3) return null;
  // Cut at the largest empty arc so 23:55 and 00:05 remain ten minutes apart.
  const sorted = [...values].sort((a, b) => a - b);
  let gap = -1,
    start = 0;
  sorted.forEach((v, i) => {
    const next =
      sorted[(i + 1) % sorted.length] + (i === sorted.length - 1 ? 1440 : 0);
    if (next - v > gap) {
      gap = next - v;
      start = sorted[(i + 1) % sorted.length];
    }
  });
  const unwrapped = values
    .map((v) => (v < start ? v + 1440 : v))
    .sort((a, b) => a - b);
  const middle = Math.floor(unwrapped.length / 2),
    median =
      unwrapped.length % 2
        ? unwrapped[middle]
        : (unwrapped[middle - 1] + unwrapped[middle]) / 2;
  return {
    typical: median % 1440,
    earliest: unwrapped[0] % 1440,
    latest: unwrapped.at(-1)! % 1440,
    range: unwrapped.at(-1)! - unwrapped[0],
    count: values.length,
  };
}
export function weeklyMealTimes(
  meals: TimedMeal[],
  today: string,
  timezone: string,
) {
  const start = mondayOf(today),
    prior = addDays(start, -7);
  const timed = meals
    .filter((m) => m.status === "completed" && m.completed_at)
    .map((m) => ({ slot: m.slot, time: timeParts(m.completed_at!, timezone) }))
    .filter((m) => m.time);
  return ["Breakfast", "Lunch", "Dinner", "Snack"].map((slot) => {
    const current = distribution(
      timed
        .filter(
          (m) =>
            m.slot === slot && m.time!.date >= start && m.time!.date <= today,
        )
        .map((m) => m.time!.minutes),
    );
    const previous = distribution(
      timed
        .filter(
          (m) =>
            m.slot === slot && m.time!.date >= prior && m.time!.date < start,
        )
        .map((m) => m.time!.minutes),
    );
    const shift =
      current && previous
        ? ((current.typical - previous.typical + 2160) % 1440) - 720
        : null;
    return { slot, current, previous, shift };
  });
}
