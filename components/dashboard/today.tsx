"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Plus,
  Scale,
  Dumbbell,
  Droplets,
  Utensils,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Flame,
  Trash2,
  RotateCcw,
  Sun,
} from "lucide-react";
import type { DashboardData, Meal } from "@/types/domain";
import { formatDate, addDays, mondayOf, localDate } from "@/lib/date";
import { formatWeight, fromKg } from "@/lib/nutrition/units";
import { dailySummary, weightProgress } from "@/lib/analytics/daily";
import {
  setCheck,
  logWater,
  changeMeal,
  deleteExtra,
} from "@/app/(app)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { WeightDialog, WorkoutDialog, FoodDialog } from "./tracking-forms";
import { useMutation } from "./use-mutation";
const WeightChart = dynamic(
  () => import("./weight-chart").then((m) => m.WeightChart),
  { ssr: false, loading: () => <div style={{ height: 80 }} /> },
);
function Meter({
  label,
  value,
  target,
  unit,
  color,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
}) {
  return (
    <div className="meter">
      <div>
        <span>
          <i style={{ background: color }} />
          {label}
        </span>
        <span>
          <strong>{Math.round(value).toLocaleString()}</strong> /{" "}
          {target.toLocaleString()} <small>{unit}</small>
        </span>
      </div>
      <div
        className="meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.min(value, target)}
        aria-valuemin={0}
        aria-valuemax={target}
      >
        <span
          style={{
            width: `${Math.min(100, target ? (value / target) * 100 : 0)}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}
function MealCard({ meal }: { meal: Meal }) {
  const { pending, error, run } = useMutation();
  return (
    <article className={`meal-card ${meal.status}`}>
      <div className="meal-card-top">
        <span className="meal-slot">
          <Utensils size={13} />
          {meal.slot}
        </span>
        <span>
          {meal.estimated_cost !== null
            ? `$${Number(meal.estimated_cost).toFixed(2)} estimated`
            : "Your meal"}
        </span>
      </div>
      <h3>{meal.name}</h3>
      <p className="meal-ingredients">
        {meal.ingredients.length
          ? meal.ingredients
              .map((i) => `${i.quantity_g} g ${i.name}`)
              .join(" · ")
          : "Portions included in your nutrition totals"}
      </p>
      <div className="meal-macros">
        <strong>
          {Math.round(meal.calories)} <small>kcal</small>
        </strong>
        <span>{meal.protein}g protein</span>
        <span>{meal.carbs}g carbs</span>
        <span>{meal.fat}g fat</span>
        <span>{meal.fiber}g fiber</span>
      </div>
      <div className="meal-controls">
        <Button
          variant={meal.status === "completed" ? "outline" : "default"}
          disabled={pending}
          onClick={() =>
            run(() =>
              changeMeal({
                id: meal.id,
                status: meal.status === "completed" ? "planned" : "completed",
              }),
            )
          }
        >
          {meal.status === "completed" ? (
            <>
              <Check size={14} /> Eaten · undo
            </>
          ) : (
            <>
              <Check size={14} /> Mark as eaten
            </>
          )}
        </Button>
        <button
          className="text-button"
          disabled={pending}
          onClick={() =>
            run(() =>
              changeMeal({
                id: meal.id,
                status: meal.status === "skipped" ? "planned" : "skipped",
              }),
            )
          }
        >
          {meal.status === "skipped" ? "Restore" : "Skip"}
        </button>
        <button
          className="icon-button"
          aria-label={`Remove ${meal.name}`}
          disabled={pending}
          onClick={() =>
            run(() => changeMeal({ id: meal.id, status: "deleted" }))
          }
        >
          <Trash2 size={14} />
        </button>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
export function TodayDashboard({
  data,
  viewingHistory,
}: {
  data: DashboardData;
  viewingHistory: boolean;
}) {
  const { pending, error, run } = useMutation();
  const router = useRouter();
  const summary = dailySummary(data);
  const todaysWeight = data.weights.find((w) => w.local_date === data.date);
  const availableWeights = data.weights.filter(
    (w) => w.local_date <= data.date,
  );
  const current =
    availableWeights.at(-1)?.weight_kg ?? data.profile.starting_weight_kg;
  const progress = weightProgress(
    data.profile.starting_weight_kg,
    current,
    data.goal.goal_weight_kg,
  );
  const workout = data.workouts.find((w) => w.local_date === data.date);
  const week = mondayOf(data.date);
  useEffect(() => {
    const interval = setInterval(() => {
      if (!viewingHistory && localDate(data.profile.timezone) !== data.date)
        router.refresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [data.date, data.profile.timezone, router, viewingHistory]);
  const checkNames = {
    breakfast: "Ate breakfast",
    lunch: "Ate lunch",
    dinner: "Ate dinner",
    protein: "Hit protein goal",
    fiber: "Hit fiber goal",
  } as const;
  const weekPercent = data.weekLogs.length
    ? Math.round(
        (data.weekLogs.reduce(
          (s, d) =>
            s +
            [
              d.breakfast,
              d.lunch,
              d.dinner,
              d.protein,
              d.fiber,
              d.water_ml >= data.targets.water_ml,
            ].filter(Boolean).length /
              6,
          0,
        ) /
          data.weekLogs.length) *
          100,
      )
    : null;
  return (
    <div className="today">
      <section className="dashboard-heading">
        <div className="page-title">
          <span className="eyebrow">
            {formatDate(data.date, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }).toUpperCase()}
          </span>
          <h1>
            {data.date === data.today ? data.greeting : "Your daily record"},{" "}
            {data.profile.first_name}
            <span className="brand-dot">.</span>
          </h1>
          <p>Let’s make room for a good day.</p>
        </div>
        <div className="date-navigation">
          <Link
            href={`/dashboard?date=${addDays(data.date, -1)}`}
            className="icon-button"
            aria-label="Previous day"
          >
            <ChevronLeft size={16} />
          </Link>
          <label>
            <span className="sr-only">Tracking date</span>
            <input
              type="date"
              value={data.date}
              min={addDays(data.today, -365)}
              max={data.today}
              onChange={(e) => {
                if (e.target.value)
                  router.push(`/dashboard?date=${e.target.value}`);
              }}
            />
          </label>
          {data.date < data.today ? (
            <Link
              href={`/dashboard?date=${addDays(data.date, 1)}`}
              className="icon-button"
              aria-label="Next day"
            >
              <ChevronRight size={16} />
            </Link>
          ) : (
            <button className="icon-button" disabled aria-label="Next day">
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </section>
      {data.date !== data.today && (
        <p className="notice history-notice">
          You’re viewing {formatDate(data.date)}.{" "}
          <Link href="/dashboard">Return to today →</Link>
        </p>
      )}
      <div className="dashboard-primary">
        <section className="daily-rhythm">
          <div className="rhythm-top">
            <span className="eyebrow">
              <Sun size={13} /> YOUR DAILY RHYTHM
            </span>
            <span className="pill">
              <i />
              {summary.status}
            </span>
          </div>
          <div className="rhythm-body">
            <div>
              <h2>
                Every small step
                <br />
                moves you forward.
              </h2>
              <p>
                {summary.completed === 0
                  ? "Start wherever feels easiest."
                  : summary.completed === summary.total
                    ? "You’ve shown up for every part of your day."
                    : "A little consistency goes a long way."}
              </p>
              <a href="#daily-checklist" className="rhythm-link">
                Your daily check-in <ArrowRight size={15} />
              </a>
            </div>
            <div
              className="completion-ring"
              style={{
                background: `conic-gradient(#557244 ${(summary.completed / summary.total) * 360}deg,#d4dfc7 0)`,
              }}
              role="progressbar"
              aria-label="Daily completion"
              aria-valuemin={0}
              aria-valuemax={summary.total}
              aria-valuenow={summary.completed}
            >
              <div>
                <strong>
                  {summary.completed}
                  <span>/{summary.total}</span>
                </strong>
                <small>COMPLETED</small>
              </div>
            </div>
          </div>
          <div className="rhythm-footer">
            <span>
              <Leaf size={13} /> Progress over perfection.
            </span>
            <span>
              {Math.round((summary.completed / summary.total) * 100)}% of your
              daily rhythm
            </span>
          </div>
        </section>
        <section className="card nutrition-card">
          <div className="section-heading">
            <h2>Today’s nutrition</h2>
            <Link
              href="/plan"
              className="icon-button"
              aria-label="View nutrition targets"
            >
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="calorie-total">
            <Flame size={20} />
            <strong>
              {Math.round(summary.consumed.calories).toLocaleString()}
            </strong>
            <span>/ {data.targets.calories.toLocaleString()} kcal</span>
            <small>
              {Math.max(
                0,
                Math.round(data.targets.calories - summary.consumed.calories),
              ).toLocaleString()}{" "}
              left
            </small>
          </div>
          <div className="calorie-track">
            <span
              style={{
                width: `${Math.min(100, (summary.consumed.calories / data.targets.calories) * 100)}%`,
              }}
            />
          </div>
          <div className="nutrition-meters">
            <Meter
              label="Protein"
              value={summary.consumed.protein}
              target={data.targets.protein}
              unit="g"
              color="#658759"
            />
            <Meter
              label="Carbs"
              value={summary.consumed.carbs}
              target={data.targets.carbs}
              unit="g"
              color="#c4a770"
            />
            <Meter
              label="Fat"
              value={summary.consumed.fat}
              target={data.targets.fat}
              unit="g"
              color="#aaa2be"
            />
            <Meter
              label="Fiber"
              value={summary.consumed.fiber}
              target={data.targets.fiber}
              unit="g"
              color="#88aaa5"
            />
          </div>
          <p className="fine-print muted">
            From meals marked eaten and extra food. Checkoffs alone don’t add
            nutrition.
          </p>
        </section>
      </div>
      <div className="dashboard-middle">
        <section className="card checklist-card" id="daily-checklist">
          <div className="section-heading">
            <h2>The daily essentials</h2>
            <span className="muted">
              {summary.completed} of {summary.total}
            </span>
          </div>
          <div className="checklist">
            {(Object.keys(checkNames) as (keyof typeof checkNames)[]).map(
              (key) => {
                const inferred = summary.checks[key] && !data.log[key];
                return (
                  <button
                    key={key}
                    className={`checklist-item ${summary.checks[key] ? "checked" : ""}`}
                    aria-pressed={summary.checks[key]}
                    disabled={pending || inferred}
                    onClick={() =>
                      run(() =>
                        setCheck({
                          date: data.date,
                          key,
                          value: !data.log[key],
                        }),
                      )
                    }
                  >
                    <span className="check-box">
                      {summary.checks[key] && <Check size={13} />}
                    </span>
                    <span>{checkNames[key]}</span>
                    {inferred && <small>From meals</small>}
                  </button>
                );
              },
            )}
            {!data.log.rest_day && (
              <WorkoutDialog date={data.date} workout={workout}>
                <button
                  className={`checklist-item ${workout ? "checked" : ""}`}
                >
                  <span className="check-box">
                    {workout && <Check size={13} />}
                  </span>
                  <span>Worked out</span>
                  <ArrowUpRight size={13} />
                </button>
              </WorkoutDialog>
            )}
            <button
              className={`checklist-item ${summary.checks.water ? "checked" : ""}`}
              disabled={pending || summary.checks.water}
              onClick={() =>
                run(() => logWater({ date: data.date, amount: "goal" }))
              }
            >
              <span className="check-box">
                {summary.checks.water && <Check size={13} />}
              </span>
              <span>Hit water goal</span>
            </button>
            <WeightDialog
              date={data.date}
              units={data.profile.units}
              weight={todaysWeight?.weight_kg}
            >
              <button
                className={`checklist-item ${summary.checks.weight ? "checked" : ""}`}
              >
                <span className="check-box">
                  {summary.checks.weight && <Check size={13} />}
                </span>
                <span>Weighed in</span>
                <ArrowUpRight size={13} />
              </button>
            </WeightDialog>
          </div>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="card weight-card">
          <div className="section-heading">
            <h2>
              <Scale size={16} /> Your weight
            </h2>
            <WeightDialog
              date={data.date}
              units={data.profile.units}
              weight={todaysWeight?.weight_kg}
            >
              <button className="icon-button" aria-label="Log weight">
                <Plus size={18} />
              </button>
            </WeightDialog>
          </div>
          {todaysWeight ? (
            <div className="large-value">
              {fromKg(todaysWeight.weight_kg, data.profile.units).toFixed(1)}
              <span>{data.profile.units === "imperial" ? "lb" : "kg"}</span>
            </div>
          ) : (
            <>
              <div className="large-value empty-value">
                —<span>{data.profile.units === "imperial" ? "lb" : "kg"}</span>
              </div>
              <p className="muted weight-prompt">
                Did you weigh yourself today?
              </p>
              <WeightDialog date={data.date} units={data.profile.units}>
                <Button variant="outline">
                  Log my weight <Plus size={13} />
                </Button>
              </WeightDialog>
            </>
          )}
          {availableWeights.length > 1 ? (
            <WeightChart
              entries={availableWeights.slice(-14)}
              units={data.profile.units}
              compact
            />
          ) : (
            <div className="weight-chart-empty">
              <span />
              <p>
                {availableWeights.length
                  ? "One check-in down. Keep going."
                  : "Your trend starts with a first check-in."}
              </p>
            </div>
          )}
          <div className="weight-stats">
            <div>
              <span>Starting</span>
              <strong>
                {formatWeight(
                  data.profile.starting_weight_kg,
                  data.profile.units,
                )}
              </strong>
            </div>
            <div>
              <span>Current</span>
              <strong>{formatWeight(current, data.profile.units)}</strong>
            </div>
            <div>
              <span>Goal</span>
              <strong>
                {formatWeight(data.goal.goal_weight_kg, data.profile.units)}
              </strong>
            </div>
          </div>
          <div className="weight-change">
            <span>
              {progress.change > 0 ? "+" : ""}
              {fromKg(progress.change, data.profile.units).toFixed(1)}{" "}
              {data.profile.units === "imperial" ? "lb" : "kg"} total change
            </span>
            <Link href="/progress">
              View history <ArrowUpRight size={12} />
            </Link>
          </div>
        </section>
        <div className="movement-stack">
          <section className="card workout-card">
            <div className="section-heading">
              <h2>
                <Dumbbell size={16} /> Movement
              </h2>
              <span className="pill">
                {data.workouts.length} / {data.workoutTarget} this week
              </span>
            </div>
            <div className="week-progress">
              {Array.from({ length: 7 }, (_, i) => {
                const d = addDays(week, i);
                const active = data.workouts.some((w) => w.local_date === d);
                return (
                  <div
                    key={d}
                    className={
                      active ? "done" : d === data.date ? "current" : ""
                    }
                  >
                    <span>{["M", "T", "W", "T", "F", "S", "S"][i]}</span>
                    <b>
                      {active ? (
                        <Check size={12} />
                      ) : (
                        new Date(`${d}T12:00Z`).getUTCDate()
                      )}
                    </b>
                  </div>
                );
              })}
            </div>
            <div className="workout-bottom">
              <WorkoutDialog date={data.date} workout={workout}>
                <Button variant="outline">
                  {workout ? (
                    <>
                      <Check size={14} />
                      {workout.workout_type}
                    </>
                  ) : (
                    <>
                      Log a workout <Plus size={14} />
                    </>
                  )}
                </Button>
              </WorkoutDialog>
              <button
                disabled={pending}
                className={`text-button ${data.log.rest_day ? "active" : ""}`}
                aria-pressed={data.log.rest_day}
                onClick={() =>
                  run(() =>
                    setCheck({
                      date: data.date,
                      key: "rest_day",
                      value: !data.log.rest_day,
                    }),
                  )
                }
              >
                {data.log.rest_day ? "✓ Rest day" : "Rest day"}
              </button>
            </div>
          </section>
          <section className="card water-card">
            <div className="section-heading">
              <h2>
                <Droplets size={17} /> Stay hydrated
              </h2>
              <span className="water-total">
                <strong>
                  {(data.log.water_ml / 1000).toFixed(2).replace(/0$/, "")}
                </strong>{" "}
                / {(data.targets.water_ml / 1000).toFixed(1)} L
              </span>
            </div>
            <div
              className="water-levels"
              role="progressbar"
              aria-label="Water"
              aria-valuenow={Math.min(data.log.water_ml, data.targets.water_ml)}
              aria-valuemin={0}
              aria-valuemax={data.targets.water_ml}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <span
                  key={i}
                  className={
                    data.log.water_ml / data.targets.water_ml > i / 12
                      ? "filled"
                      : ""
                  }
                />
              ))}
            </div>
            <div className="water-controls">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(() => logWater({ date: data.date, amount: 250 }))
                }
              >
                + 250 mL
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(() => logWater({ date: data.date, amount: 500 }))
                }
              >
                + 500 mL
              </Button>
              <button
                className="icon-button"
                disabled={pending || data.log.water_ml === 0}
                onClick={() =>
                  run(() => logWater({ date: data.date, amount: -250 }))
                }
                aria-label="Remove 250 mL"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </section>
        </div>
      </div>
      <section className="meals-section">
        <div className="section-heading">
          <div>
            <h2>On the menu today</h2>
            <p className="muted">Your meals. A few simple check-ins.</p>
          </div>
          <FoodDialog date={data.date} foods={data.foods}>
            <Button variant="outline">
              <Plus size={15} /> Add a meal
            </Button>
          </FoodDialog>
        </div>
        {data.meals.length ? (
          <div className="meals-grid">
            {data.meals.map((meal) => (
              <MealCard key={meal.id} meal={meal} />
            ))}
          </div>
        ) : (
          <div className="empty-meals">
            <div className="empty-icon">
              <Utensils size={24} />
            </div>
            <div>
              <h3>A good day starts with a meal.</h3>
              <p>
                Add what you’re planning to eat, then check it off when you’re
                done.
              </p>
              <span>
                Automatic meal recommendations are coming in the next phase.
              </span>
            </div>
            <FoodDialog date={data.date} foods={data.foods}>
              <Button>
                Add your first meal <ArrowRight size={14} />
              </Button>
            </FoodDialog>
          </div>
        )}
      </section>
      <div className="dashboard-bottom">
        <section className="card extra-food-card">
          <div className="section-heading">
            <h2>A little extra</h2>
            <FoodDialog date={data.date} foods={data.foods} extra>
              <button className="text-button">
                <Plus size={14} /> Add extra food
              </button>
            </FoodDialog>
          </div>
          {data.extras.length ? (
            <ul className="extra-list">
              {data.extras.map((extra) => (
                <li key={extra.id}>
                  <span>
                    <strong>{extra.name}</strong>
                    <small>
                      {extra.protein}g protein · {extra.fiber}g fiber
                    </small>
                  </span>
                  <span>{extra.calories} kcal</span>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${extra.name}`}
                    disabled={pending}
                    onClick={() => run(() => deleteExtra(extra.id))}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted fine-print">
              Snacks, an extra helping, or something unplanned. It all has a
              place.
            </p>
          )}
        </section>
        <section className="foundation-card">
          <span className="eyebrow">YOUR BIGGER PICTURE</span>
          <div>
            <div>
              <strong>
                {Math.round(progress.percent)}
                <small>%</small>
              </strong>
              <span>Toward goal weight</span>
            </div>
            <div>
              <strong>${data.budget}</strong>
              <span>Monthly grocery budget</span>
            </div>
            <div>
              <strong>{weekPercent === null ? "—" : `${weekPercent}%`}</strong>
              <span>Recorded habit checkoffs</span>
            </div>
          </div>
          <Link href="/plan">
            A plan built around you <ArrowUpRight size={14} />
          </Link>
        </section>
      </div>
    </div>
  );
}
