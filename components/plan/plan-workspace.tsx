"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Sparkles,
  RefreshCw,
  Save,
  ArrowUpRight,
  Utensils,
  ShoppingBasket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { optimizePlan, type Objective } from "@/lib/optimization/engine";
import { OptimizationSummary } from "./optimization-summary";
import { generatePlan, swapMeal } from "@/lib/meal-plan/generator";
import { dayMacros, planWarnings } from "@/lib/meal-plan/calculations";
import { addDays, formatDate } from "@/lib/date";
import { savePlan } from "@/app/(app)/plan/actions";
import type { PlanContext, PlanDay, MealTemplate } from "@/lib/meal-plan/types";
import { MacroComparison } from "./macro-comparison";
import { PantryDiscovery } from "./pantry-discovery";
import { MealPreview } from "./meal-preview";
export function PlanWorkspace({
  context: baseContext,
}: {
  context: PlanContext;
}) {
  const [objective, setObjective] = useState<Objective>("Balanced");
  const [settings, setSettings] = useState({
    maxStores: 2,
    extraStorePenalty: 5,
  });
  const context = useMemo(
    () => ({
      ...baseContext,
      optimization: baseContext.optimization
        ? { ...baseContext.optimization, ...settings }
        : undefined,
    }),
    [baseContext, settings],
  );
  const [days, setDays] = useState(context.days);
  const [dirty, setDirty] = useState<string[]>([]);
  const [selected, setSelected] = useState(context.today);
  const [revision, setRevision] = useState(context.revision);
  const [variation, setVariation] = useState(0);
  const [discovery, setDiscovery] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const incoming = JSON.stringify(baseContext.days);
  const [previousIncoming, setPreviousIncoming] = useState(incoming);
  if (previousIncoming !== incoming) {
    setPreviousIncoming(incoming);
    if (!dirty.length) {
      setDays(baseContext.days);
      setRevision(baseContext.revision);
    } else {
      setDays((ds) =>
        ds.map(
          (d) =>
            baseContext.days.find(
              (n) =>
                n.date === d.date &&
                n.meals.some((m) => m.status && m.status !== "planned"),
            ) || d,
        ),
      );
    }
  }
  const draftContext = useMemo(() => ({ ...context, days }), [context, days]);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(context.today, i));
  const day = days.find((d) => d.date === selected);
  const locked = (d: PlanDay) =>
    d.meals.some((m) => m.status && m.status !== "planned");
  function generate(single = false) {
    setError("");
    setMessage("");
    startTransition(async () => {
      setGenerating(true);
      try {
        const generated = context.optimization
          ? (
              await optimizePlan(
                { ...context, days },
                single ? selected : context.today,
                single ? 1 : 7,
                objective,
                variation,
              )
            ).days
          : generatePlan(
              { ...context, days },
              single ? selected : context.today,
              single ? 1 : 7,
              variation,
            );
        const editable = generated.filter(
          (d) =>
            !days.some(
              (existing) => existing.date === d.date && locked(existing),
            ),
        );
        setDays((previous) =>
          [
            ...previous.filter((d) => !editable.some((e) => e.date === d.date)),
            ...editable,
          ].sort((a, b) => a.date.localeCompare(b.date)),
        );
        setDirty((previous) => [
          ...new Set([...previous, ...editable.map((d) => d.date)]),
        ]);
        setVariation((v) => v + 1);
        if (!editable.length)
          setError(
            "Days with completed or skipped meals are protected. Choose a different day.",
          );
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "The plan could not be generated.",
        );
      } finally {
        setGenerating(false);
      }
    });
  }
  function replace(index: number, t: MealTemplate) {
    if (!day) return;
    setDays((ds) =>
      ds.map((d) => (d.date === selected ? swapMeal(d, index, t, context) : d)),
    );
    setDirty((ds) => [...new Set([...ds, selected])]);
    setMessage("");
  }
  function save() {
    startTransition(async () => {
      try {
        const result = await savePlan({
          revision,
          days: days.filter((d) => dirty.includes(d.date)),
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        setRevision(result.revision!);
        setDirty([]);
        setMessage(
          "Plan saved. Your meals are ready on Today and your grocery requirements are updated.",
        );
      } catch {
        setError("Your plan could not be saved. Please reload and try again.");
      }
    });
  }
  return (
    <div className="secondary-page">
      <header className="dashboard-heading">
        <div className="page-title">
          <span className="eyebrow">NOURISH YOUR NEXT SEVEN DAYS</span>
          <h1>
            A little planning. A better week<span className="brand-dot">.</span>
          </h1>
          <p>Familiar meals, practical portions, and room to make it yours.</p>
        </div>
        <Link href="/preferences" className="button">
          Preferences <ArrowUpRight size={14} />
        </Link>
      </header>
      <OptimizationSummary
        context={context}
        days={days}
        objective={objective}
        onObjective={setObjective}
        onSettings={(p) => setSettings((s) => ({ ...s, ...p }))}
      />
      <div className="purchase-actions">
        <Link href="/prep" className="button">
          Meal prep →
        </Link>
        <Button variant="outline" onClick={() => setDiscovery((v) => !v)}>
          {discovery ? "Hide pantry ideas" : "Cook From My Pantry"}
        </Button>
      </div>
      {discovery && (
        <PantryDiscovery
          context={{ ...context, today: selected }}
          locked={Boolean(day && locked(day)) || pending}
          onChoose={(t, slot) => {
            try {
              const base =
                day ||
                generatePlan({ ...context, days }, selected, 1, variation)[0];
              const index = base.meals.findIndex((m) => m.slot === slot);
              if (index < 0) {
                setError(
                  `Your ${context.preferences.mealsPerDay}-meal schedule has no ${slot.toLowerCase()} slot. Choose another slot or change meals per day.`,
                );
                return;
              }
              const next = swapMeal(base, index, t, context);
              setDays((ds) =>
                [...ds.filter((d) => d.date !== selected), next].sort((a, b) =>
                  a.date.localeCompare(b.date),
                ),
              );
              setDirty((ds) => [...new Set([...ds, selected])]);
              setDiscovery(false);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Could not use this meal",
              );
            }
          }}
        />
      )}
      <section className="plan-toolbar card">
        <div>
          <Utensils size={22} />
          <span>
            <strong>Your next seven days</strong>
            <small>
              {context.preferences.mealsPerDay} meals a day · up to{" "}
              {context.preferences.cookingMinutes} minutes ·{" "}
              {context.preferences.restrictions.join(", ") || "Flexible eating"}
            </small>
          </span>
        </div>
        <div className="toolbar-actions">
          <Button
            variant="outline"
            onClick={() => generate()}
            disabled={pending}
          >
            <Sparkles size={15} />{" "}
            {generating
              ? "Comparing plans…"
              : days.length
                ? "Generate new week"
                : "Generate week"}
          </Button>
          <Button onClick={save} disabled={pending || !dirty.length}>
            <Save size={15} />{" "}
            {pending && !generating ? "Saving…" : "Save plan"}
          </Button>
        </div>
      </section>
      {dirty.length > 0 && (
        <p className="notice">
          Unsaved draft · {dirty.length} {dirty.length === 1 ? "day" : "days"}{" "}
          changed. Save to update Today.{" "}
          <button
            className="text-button"
            onClick={() => {
              setDays(context.days);
              setDirty([]);
              setRevision(context.revision);
            }}
          >
            Discard draft
          </button>
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="plan-week" aria-label="Plan days">
        {dates.map((date) => {
          const d = days.find((d) => d.date === date);
          return (
            <button
              aria-pressed={selected === date}
              className={selected === date ? "selected" : ""}
              key={date}
              onClick={() => setSelected(date)}
            >
              <span>
                {date === context.today
                  ? "Today"
                  : formatDate(date, { weekday: "short" })}
              </span>
              <strong>{formatDate(date, { day: "numeric" })}</strong>
              <small>
                {d ? `${Math.round(dayMacros(d).calories)} kcal` : "No plan"}
              </small>
              {dirty.includes(date) && <i />}
            </button>
          );
        })}
      </div>
      {day && day.meals.length > 0 ? (
        <>
          <section className="card">
            <div className="section-heading">
              <h2>{formatDate(selected)}</h2>
              <Button
                variant="ghost"
                disabled={pending || locked(day)}
                onClick={() => generate(true)}
              >
                <RefreshCw size={13} /> Regenerate day
              </Button>
            </div>
            <MacroComparison actual={dayMacros(day)} target={context.targets} />
            {planWarnings(day, context.targets).map((w) => (
              <p className="notice warning" key={w}>
                {w}
              </p>
            ))}
            {locked(day) && (
              <p className="fine-print muted">
                This day has a completed or skipped meal. Its saved plan is
                protected to preserve your tracking history.
              </p>
            )}
          </section>
          <div className="plan-meals-grid">
            {day.meals.map((meal, i) => (
              <MealPreview
                key={`${meal.key}-${meal.template_id}`}
                meal={meal}
                context={draftContext}
                locked={locked(day) || pending}
                onSwap={(t) => replace(i, t)}
              />
            ))}
          </div>
          <div className="plan-next">
            <Link href="/dashboard" className="button">
              Track your meals <ArrowUpRight size={14} />
            </Link>
            <Link href="/groceries" className="button">
              <ShoppingBasket size={15} /> Grocery requirements
            </Link>
          </div>
        </>
      ) : (
        <section className="empty-meals">
          <div className="empty-icon">
            <Utensils size={24} />
          </div>
          <div>
            <h3>Make a little room for the week ahead.</h3>
            <p>
              Generate a draft using your nutrition targets and saved
              preferences, then review before saving.
            </p>
          </div>
          <Button onClick={() => generate()} disabled={pending}>
            Generate week <Sparkles size={14} />
          </Button>
        </section>
      )}
      <p className="fine-print muted">
        Nutrition uses development reference estimates per 100 g in the stated
        raw, dry, or prepared form. Verify packaging for your food. Portions are
        a starting point, not a guarantee of meeting every target.{" "}
        {context.preferences.restrictions.some((r) =>
          ["halal", "kosher"].includes(r.toLowerCase()),
        )
          ? "For halal or kosher preferences, this starter library uses plant-based ingredients only; verify product certification."
          : ""}
      </p>
    </div>
  );
}
