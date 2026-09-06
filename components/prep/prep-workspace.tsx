"use client";
import { useState, useOptimistic } from "react";
import Link from "next/link";
import { haptic } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useMutation } from "@/components/dashboard/use-mutation";
import { createPrep, setPrepTask } from "@/app/(app)/prep/actions";
import { addDays } from "@/lib/date";
import { formatFoodQuantity } from "@/lib/food/quantities";
import { prepAvailability, type PrepSession } from "@/lib/prep/planning";
import type { PlanContext } from "@/lib/meal-plan/types";
export function PrepWorkspace({
  context,
  sessions,
}: {
  context: PlanContext;
  sessions: PrepSession[];
}) {
  const [open, setOpen] = useState(false),
    [id, setId] = useState(() => crypto.randomUUID());
  const { pending, error, run } = useMutation();
  return (
    <div className="secondary-page">
      <header className="dashboard-heading">
        <div className="page-title">
          <span className="eyebrow">A LITTLE PREPARATION GOES A LONG WAY</span>
          <h1>Make room for an easier week.</h1>
          <p>
            Cooking tasks from your saved recipes, grouped when preparations
            match.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (v) setId(crypto.randomUUID());
          }}
        >
          <DialogTrigger asChild>
            <Button>Create prep session</Button>
          </DialogTrigger>
          <DialogContent
            title="Plan a little prep"
            description="Batch compatible cooking steps from upcoming saved, uneaten meals."
          >
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(
                  () =>
                    createPrep({ id, date: f.get("date"), end: f.get("end") }),
                  () => setOpen(false),
                );
              }}
            >
              <label className="field">
                Prep date
                <input
                  type="date"
                  name="date"
                  required
                  min={context.today}
                  max={addDays(context.today, 13)}
                  defaultValue={context.today}
                />
              </label>
              <label className="field">
                Meals through
                <input
                  type="date"
                  name="end"
                  required
                  min={context.today}
                  max={addDays(context.today, 13)}
                  defaultValue={addDays(context.today, 2)}
                />
              </label>
              {error && (
                <p role="alert" className="error-text">
                  {error}
                </p>
              )}
              <Button disabled={pending}>Build prep tasks</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>
      <p className="notice">
        Prep checkmarks organize your work. Pantry stock is deducted only when
        you mark meals as eaten on Today. Opening or completing prep never
        deducts it again.
      </p>
      <div className="purchase-actions">
        <Link href="/plan" className="button">
          Meal plan →
        </Link>
        <Link href="/groceries" className="button">
          Missing ingredients →
        </Link>
      </div>
      {!sessions.length && (
        <section className="card progress-empty">
          <h2>Your next week can start here.</h2>
          <p>
            Save a meal plan, then build a cooking checklist from its recipes.
          </p>
        </section>
      )}
      {sessions.map((s) => (
        <Session key={s.id} session={s} context={context} />
      ))}
    </div>
  );
}
function Session({
  session: s,
  context,
}: {
  session: PrepSession;
  context: PlanContext;
}) {
  const { pending, error, run } = useMutation();
  const [tasks, updateTask] = useOptimistic(
    s.tasks,
    (current, change: { key: string; completed: boolean }) =>
      current.map((t) =>
        (t.key || t.food_id) === change.key
          ? { ...t, completed: change.completed }
          : t,
      ),
  );
  const completed = tasks.filter((t) => t.completed).length;
  return (
    <section className="card prep-session">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{s.local_date}</span>
          <h2>
            Meal prep ·{" "}
            {completed === s.tasks.length ? "Complete" : "In progress"}
          </h2>
          <p className="muted">
            {completed}/{s.tasks.length} tasks · About{" "}
            {s.tasks.reduce((n, t) => n + t.minutes, 0)} min if done one at a
            time
          </p>
        </div>
        <span className="status-pill">Meals through {s.end_date}</span>
      </div>
      {s.source_revision !== context.revision && (
        <p className="notice">
          Your plan has changed since this session was created. These tasks
          preserve the original quantities; create a new session for the updated
          plan.
        </p>
      )}
      {s.tasks.some((t) => !t.key) && (
        <p className="notice">
          This older session contains ingredient checklists. Create a new
          session for cooking tasks from your current recipes.
        </p>
      )}
      <p className="fine-print muted">
        Times are planning estimates. Follow the related recipes for cooking
        methods and doneness. Group matching preparations and store each food
        appropriately.
      </p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div>
        {tasks.map((task) => {
          const food = context.foods.find((f) => f.id === task.food_id),
            stock = prepAvailability(
              task,
              context.pantry || [],
              [s.local_date, context.today].sort().at(-1)!,
            );
          return (
            <article className="prep-task" key={task.key || task.food_id}>
              <label>
                <input
                  type="checkbox"
                  checked={task.completed}
                  disabled={pending}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    run(async () => {
                      updateTask({
                        key: task.key || task.food_id,
                        completed: checked,
                      });
                      const result = await setPrepTask({
                        id: s.id,
                        food: task.key || task.food_id,
                        completed: checked,
                        expected: s.updated_at,
                      });
                      if (
                        !result.error &&
                        checked &&
                        completed === tasks.length - 1
                      )
                        haptic();
                      return result;
                    });
                  }}
                />
                <strong>
                  {task.key ? task.name : `Legacy task: ${task.name}`}
                </strong>
              </label>
              <strong>
                {(
                  task.ingredients || [
                    { food_id: task.food_id, quantity_g: task.quantity_g },
                  ]
                )
                  .map(
                    (i) =>
                      `${formatFoodQuantity(
                        i.quantity_g,
                        context.foods.find((f) => f.id === i.food_id),
                        context.units,
                      )} ${context.foods.find((f) => f.id === i.food_id)?.name || ""}`,
                  )
                  .join(" · ")}{" "}
                · ~{task.minutes} min
              </strong>
              <p>
                Batch for {task.meal_ids.length} planned meal
                {task.meal_ids.length === 1 ? "" : "s"}. {task.instruction}
              </p>
              <p className="fine-print">
                {stock.missing
                  ? `Missing ${formatFoodQuantity(stock.missing, food, context.units, true)} · check your grocery list`
                  : `Enough usable pantry stock for the first ingredient`}{" "}
                · {task.meal_ids.length} related meals
              </p>
              <details>
                <summary>Related meals</summary>
                <ul>
                  {task.meals.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
