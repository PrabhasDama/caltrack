"use client";
import { weeklyMealTimes, clockLabel } from "@/lib/progress/meal-times";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Scale, Plus, Camera } from "lucide-react";
import { formatWeight, fromKg } from "@/lib/nutrition/units";
import { formatDate, addDays, mondayOf } from "@/lib/date";
import { weightProgress } from "@/lib/analytics/daily";
import {
  weeklySummary,
  weightTrajectory,
  weightTrend,
  plateauState,
  nutritionDays,
  measurementNames,
  measurementFromCm,
} from "@/lib/progress/analytics";
import { money } from "@/lib/pricing/calculations";
import { WeightDialog } from "./tracking-forms";
import { MeasurementEditor } from "@/components/progress/measurement-editor";
import { Button } from "@/components/ui/button";
import type { ProgressData } from "@/lib/services/progress";
const WeightChart = dynamic(
  () => import("./weight-chart").then((m) => m.WeightChart),
  { ssr: false, loading: () => <p role="status">Loading your chart…</p> },
);
export function ProgressView({ data }: { data: ProgressData }) {
  const [range, setRange] = useState(30),
    [weekOffset, setWeekOffset] = useState(0),
    [weightDate, setWeightDate] = useState(data.today);
  const units = data.profile.units,
    weights = data.weights.filter(
      (w) => range === 0 || w.local_date >= addDays(data.today, -range + 1),
    );
  const current = Number(
    data.weights.at(-1)?.weight_kg ?? data.profile.starting_weight_kg,
  );
  const progress = weightProgress(
    data.profile.starting_weight_kg,
    current,
    data.goal.goal_weight_kg,
  );
  const trajectory = weightTrajectory(
    data.weights,
    data.goal.goal_weight_kg,
    data.today,
    data.goal.goal === "maintain",
  );
  const week = weeklySummary({
    ...data.analytics,
    weights: data.weights,
    today: data.today,
    week: addDays(mondayOf(data.today), weekOffset),
    targets: data.targets,
    workoutTarget: data.workoutTarget,
  });
  const plateau = plateauState(
    data.weights,
    data.today,
    nutritionDays(data.analytics.meals, data.analytics.extras).map(
      (d) => d.date,
    ),
  );
  const delta = (kg: number) =>
    `${kg > 0 ? "+" : ""}${fromKg(kg, units).toFixed(1)} ${units === "imperial" ? "lb" : "kg"}`;
  const periodChange =
    weights.length >= 2
      ? Number(weights.at(-1)!.weight_kg) - Number(weights[0].weight_kg)
      : null;
  const recentTrend = weightTrend(data.weights).at(-1);
  return (
    <div className="secondary-page progress-page">
      <header className="dashboard-heading">
        <div className="page-title">
          <span className="eyebrow">ONE CHECK-IN AT A TIME</span>
          <h1>
            See the bigger picture<span className="brand-dot">.</span>
          </h1>
          <p>Small patterns, useful context. Your progress belongs to you.</p>
        </div>
        <div className="progress-log-control">
          <label className="field">
            Weigh-in date
            <input
              type="date"
              max={data.today}
              min={addDays(data.today, -365)}
              value={weightDate}
              onChange={(e) => setWeightDate(e.target.value)}
            />
          </label>
          <WeightDialog
            key={weightDate}
            date={weightDate}
            units={units}
            weight={
              data.weights.find((w) => w.local_date === weightDate)?.weight_kg
            }
          >
            <Button>
              <Plus size={15} /> Log weight
            </Button>
          </WeightDialog>
        </div>
      </header>
      <div className="progress-stats">
        {[
          [
            "Starting weight",
            formatWeight(data.profile.starting_weight_kg, units),
          ],
          [
            "Current weight",
            data.weights.length ? formatWeight(current, units) : "—",
          ],
          ["Goal weight", formatWeight(data.goal.goal_weight_kg, units)],
          [
            "Change since start",
            data.weights.length ? delta(progress.change) : "—",
          ],
        ].map(([label, value]) => (
          <div className="card" key={label}>
            <span className="label">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="card meal-time-summary">
        <h2>Your meal logging rhythm</h2>
        <p className="muted">
          Actual completion times in {data.profile.timezone}. A pattern needs at
          least three timed meals per slot in a week. Planned times and older
          entries without timestamps are excluded.
        </p>
        {weeklyMealTimes(
          data.analytics.meals,
          data.today,
          data.profile.timezone,
        ).map((t) => (
          <div key={t.slot}>
            <strong>{t.slot}</strong>
            <p>
              {t.current
                ? `${clockLabel(t.current.typical)} typical · ${clockLabel(t.current.earliest)}–${clockLabel(t.current.latest)} range · ${t.current.count} logged`
                : "Not enough timed meals this week yet."}
            </p>
            {t.shift !== null && (
              <p className="fine-print">
                {Math.abs(t.shift) < 15
                  ? "Similar timing to last week."
                  : `Typically ${Math.round(Math.abs(t.shift))} minutes ${t.shift > 0 ? "later" : "earlier"} than last week.`}{" "}
                This is a reflection of your routine, with no preferred
                schedule.
              </p>
            )}
          </div>
        ))}
      </section>
      <section className="card goal-trajectory">
        <div>
          <span className="status-pill">{trajectory.state}</span>
          <h2>Your direction, over time</h2>
          <p>
            {trajectory.weeklyKg === null
              ? "Keep logging for a little longer to estimate your goal timeline."
              : `${delta(trajectory.weeklyKg)} per week across your recent trend.`}
          </p>
          <p>
            {trajectory.eta
              ? `If this pace continues, your estimated goal date is ${formatDate(trajectory.eta, { month: "long", day: "numeric", year: "numeric" })}.`
              : "No goal date estimated yet. Consistent recent data and a trend toward your goal are needed."}
          </p>
          <p className="fine-print muted">
            At least 8 weigh-ins spanning 21 days, a recent check-in, and a
            consistent direction are required. This is a rough projection, not a
            promise.
          </p>
        </div>
        <div>
          <strong>
            {Math.abs(
              data.goal.goal_weight_kg - data.profile.starting_weight_kg,
            ) < 0.01
              ? "Maintain"
              : `${Math.round(progress.percent)}%`}
          </strong>
          <span>
            {Math.abs(
              data.goal.goal_weight_kg - data.profile.starting_weight_kg,
            ) < 0.01
              ? "A steady goal, without a finish line"
              : "of your starting-to-goal change"}
          </span>
          <progress
            max={100}
            value={progress.percent}
            aria-label="Weight goal progress"
          />
          <small>
            {recentTrend
              ? `7-day trend: ${formatWeight(recentTrend.trend, units)}`
              : "Trend appears after your first weigh-in."}
          </small>
        </div>
      </section>
      <section className="card">
        <div className="section-heading">
          <h2>Your weight history</h2>
          <div className="range-tabs">
            {[
              [7, "7D"],
              [30, "30D"],
              [90, "3M"],
              [180, "6M"],
              [0, "All"],
            ].map(([v, label]) => (
              <button
                key={v}
                aria-pressed={range === v}
                className={range === v ? "active" : ""}
                onClick={() => setRange(Number(v))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {weights.length ? (
          <>
            <WeightChart
              entries={data.weights}
              since={range ? addDays(data.today, -range + 1) : undefined}
              units={units}
              goal={data.goal.goal_weight_kg}
            />
            <p className="fine-print muted">
              Dots are raw weigh-ins; the dark line averages measurements within
              the preceding 7 calendar days. Gaps are not filled with invented
              values.{" "}
              {periodChange === null
                ? "Log another entry for a period comparison."
                : `Change between the first and last measurements in this range: ${delta(periodChange)}.`}
            </p>
          </>
        ) : (
          <div className="progress-empty">
            <Scale size={30} />
            <h3>No weigh-ins in this period.</h3>
            <p>Your story starts with one check-in. There’s no rush.</p>
          </div>
        )}
      </section>
      {plateau === "stable" && (
        <section className="card notice">
          <h2>A steady stretch</h2>
          <p>
            Your weight trend has been relatively stable for the last 3 weeks.
          </p>
          <p>
            Review meal adherence, portion consistency, and workouts below, or{" "}
            <Link href="/preferences">review your calorie target</Link>. Your
            targets have not been changed.
          </p>
        </section>
      )}
      <section className="card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR WEEK IN CONTEXT</span>
            <h2>Weekly summary</h2>
            <p className="muted">
              {week.start} through {week.end}
            </p>
          </div>
          <div className="range-tabs">
            {[
              [0, "This week"],
              [-7, "Last week"],
            ].map(([v, label]) => (
              <button
                key={v}
                aria-pressed={weekOffset === v}
                className={weekOffset === v ? "active" : ""}
                onClick={() => setWeekOffset(Number(v))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <span className="status-pill">{week.nutritionState}</span>
        <p className="fine-print muted">
          Nutrition averages use {week.trackedDays} days with logged food out of{" "}
          {week.span} elapsed days. Missing days are unknown, not zero.
          Comparisons use your current targets.
        </p>
        <div className="adherence-grid">
          {(["calories", "protein", "carbs", "fat", "fiber"] as const).map(
            (k) => (
              <article key={k}>
                <span className="label">{k}</span>
                <strong>
                  {week.average[k] === null
                    ? "—"
                    : Math.round(week.average[k]!)}{" "}
                  <small>
                    / {data.targets[k]} {k === "calories" ? "kcal" : "g"}
                  </small>
                </strong>
                <p>
                  {week.hits[k]}/{week.trackedDays} logged days{" "}
                  {k === "protein" || k === "fiber"
                    ? "at least 90% of target"
                    : `within ${k === "calories" ? 10 : 20}% of target`}
                </p>
              </article>
            ),
          )}
          <article>
            <span className="label">Meals</span>
            <strong>
              {week.completed}/{week.planned}
            </strong>
            <p>Recorded meals completed · {week.skipped} skipped</p>
          </article>
          <article>
            <span className="label">Workouts</span>
            <strong>
              {week.workouts}/{week.workoutTarget}
            </strong>
            <p>Workout days / weekly goal</p>
          </article>
          <article>
            <span className="label">Tracking</span>
            <strong>{week.weightDays} weigh-ins</strong>
            <p>{week.trackedDays} days with food tracked</p>
          </article>
          <article>
            <span className="label">Weight trend change</span>
            <strong>
              {week.weightChange === null ? "—" : delta(week.weightChange)}
            </strong>
            <p>First to last available trend this week</p>
          </article>
          <article>
            <span className="label">Grocery spending</span>
            <strong>{money(week.spend, data.analytics.currency)}</strong>
            <p>
              {money(week.budgetPace, data.analytics.currency)} pace for elapsed
              days
            </p>
            <span>
              {week.spend > week.budgetPace ? "Needs attention" : "On track"}
            </span>
          </article>
        </div>
        <p className="fine-print muted">
          Budget pace uses your current monthly allowance and calendar days.
          Currencies stay separate. Meal counts include only recorded meals;
          incomplete food logs can understate intake. There is no combined
          health score.
        </p>
      </section>
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Body measurements</h2>
            <p className="muted">
              Optional check-ins, with no ideal size or score.
            </p>
          </div>
          <MeasurementEditor today={data.today} units={units} />
        </div>
        {data.measurements.length ? (
          <>
            <div className="adherence-grid">
              {measurementNames.map((k) => {
                const rows = data.measurements.filter((m) => m[k] !== null);
                const latest = rows.at(-1);
                return (
                  <article key={k}>
                    <span className="label">{k}</span>
                    <strong>
                      {latest
                        ? measurementFromCm(Number(latest[k]), units).toFixed(1)
                        : "—"}{" "}
                      {units === "imperial" ? "in" : "cm"}
                    </strong>
                    <p>
                      {rows.length > 1
                        ? `${measurementFromCm(Number(latest![k]) - Number(rows[0][k]), units).toFixed(1)} ${units === "imperial" ? "in" : "cm"} since ${rows[0].local_date}`
                        : "Add another entry to see change."}
                    </p>
                  </article>
                );
              })}
            </div>
            <details>
              <summary>Measurement history</summary>
              {[...data.measurements].reverse().map((m) => (
                <div className="measurement-row" key={m.id}>
                  <div>
                    <strong>{m.local_date}</strong>
                    <p>
                      {measurementNames
                        .filter((k) => m[k] !== null)
                        .map(
                          (k) =>
                            `${k}: ${measurementFromCm(Number(m[k]), units).toFixed(1)} ${units === "imperial" ? "in" : "cm"}`,
                        )
                        .join(" · ")}
                    </p>
                    {m.notes && <p>{m.notes}</p>}
                  </div>
                  <MeasurementEditor
                    today={data.today}
                    units={units}
                    item={m}
                  />
                </div>
              ))}
            </details>
          </>
        ) : (
          <p className="notice">
            No measurements yet. Track only what is useful to you.
          </p>
        )}
      </section>
      <Link href="/progress/photos" className="card progress-photo-link">
        <Camera />
        <span>
          <strong>Progress photos</strong>
          <small>A private space to compare your own check-ins.</small>
        </span>
      </Link>
      {!!weights.length && (
        <section className="card">
          <div className="section-heading">
            <h2>Your check-ins</h2>
            <span className="muted">{weights.length} recorded</span>
          </div>
          <div className="weight-history">
            {[...weights].reverse().map((w) => (
              <div key={w.id}>
                <span>
                  {formatDate(w.local_date, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <strong>{formatWeight(w.weight_kg, units)}</strong>
                <WeightDialog
                  date={w.local_date}
                  units={units}
                  weight={w.weight_kg}
                >
                  <button className="text-button">Edit</button>
                </WeightDialog>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
