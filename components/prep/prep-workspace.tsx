"use client";
import { useState } from "react";
import Link from "next/link";
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
            Shared ingredients, grouped once. Your saved meals lead the way.
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
            description="Group ingredients from upcoming saved, uneaten meals."
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
            Save a meal plan, then group its ingredients into a prep session.
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
  const completed = s.tasks.filter((t) => t.completed).length;
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
        {s.tasks.map((task) => {
          const food = context.foods.find((f) => f.id === task.food_id),
            stock = prepAvailability(
              task,
              context.pantry || [],
              [s.local_date, context.today].sort().at(-1)!,
            );
          return (
            <article className="prep-task" key={task.food_id}>
              <label>
                <input
                  type="checkbox"
                  checked={task.completed}
                  disabled={pending}
                  onChange={(e) =>
                    run(() =>
                      setPrepTask({
                        id: s.id,
                        food: task.food_id,
                        completed: e.target.checked,
                        expected: s.updated_at,
                      }),
                    )
                  }
                />
                <strong>Prepare {task.name}</strong>
              </label>
              <strong>
                {formatFoodQuantity(task.quantity_g, food, context.units)}
              </strong>
              <p>{task.instruction}</p>
              <p className="fine-print">
                {stock.missing
                  ? `Missing ${formatFoodQuantity(stock.missing, food, context.units, true)} · check your grocery list`
                  : `Enough usable pantry stock for this task`}{" "}
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
