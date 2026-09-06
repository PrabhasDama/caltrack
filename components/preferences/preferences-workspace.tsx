"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useMutation } from "@/components/dashboard/use-mutation";
import { savePreferences } from "@/app/(app)/preferences/actions";
import { sectionFields, type Section } from "@/lib/preferences/sections";
import { macroWarnings } from "@/lib/nutrition/macros";
import type { Macros } from "@/lib/nutrition/macros";
export function PreferencesWorkspace({
  data,
  stores,
  units,
}: {
  data: Record<Section, Record<string, unknown>>;
  stores: { id: string; name: string }[];
  units: "metric" | "imperial";
}) {
  const [message, setMessage] = useState("");
  const [planning, setPlanning] = useState(false);
  return (
    <div className="secondary-page">
      <header className="page-title">
        <span className="eyebrow">SETTINGS THAT FIT YOUR LIFE</span>
        <h1>
          Your preferences<span className="brand-dot">.</span>
        </h1>
        <p>Edit exactly what you need. Every section saves independently.</p>
      </header>
      {message && (
        <div className="notice" role="status">
          <p>{message}</p>
          {planning && (
            <Link className="button" href="/plan?preferences=updated">
              Regenerate meal plan using these preferences →
            </Link>
          )}
        </div>
      )}
      <div className="preferences-grid">
        {(Object.keys(sectionFields) as Section[]).map((section) => (
          <PreferenceCard
            key={`${section}-${JSON.stringify(data[section])}`}
            section={section}
            values={data[section]}
            stores={stores}
            units={units}
            saved={() => {
              setMessage(
                `${sectionFields[section].title} updated. Your existing plan is preserved.`,
              );
              setPlanning(sectionFields[section].planning);
            }}
          />
        ))}
      </div>
    </div>
  );
}
function PreferenceCard({
  section,
  values,
  stores,
  units,
  saved,
}: {
  section: Section;
  values: Record<string, unknown>;
  stores: { id: string; name: string }[];
  units: "metric" | "imperial";
  saved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const config = sectionFields[section];
  return (
    <section className="card preference-card" id={section}>
      <h2>{config.title}</h2>
      <p className="muted">{config.description}</p>
      <p className="fine-print preference-values">
        {section === "stores"
          ? stores
              .filter((s) => (values.stores as string[]).includes(s.id))
              .map((s) => s.name)
              .join(", ")
          : config.fields
              .slice(0, 3)
              .map((f) => {
                const v = values[f.key];
                return `${f.label}: ${f.key === "goal_weight_kg" ? `${(Number(v) * (units === "imperial" ? 2.2046226218 : 1)).toFixed(1)} ${units === "imperial" ? "lb" : "kg"}` : Array.isArray(v) ? v.join(", ") || "None" : f.options?.find(([k]) => k === String(v ?? ""))?.[1] || v || "None"}`;
              })
              .join(" · ")}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Edit {config.title.toLowerCase()}</Button>
        </DialogTrigger>
        <DialogContent title={config.title} description={config.description}>
          {open && (
            <PreferenceForm
              section={section}
              values={values}
              stores={stores}
              units={units}
              saved={() => {
                setOpen(false);
                saved();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
function PreferenceForm({
  section,
  values,
  stores,
  units,
  saved,
}: {
  section: Section;
  values: Record<string, unknown>;
  stores: { id: string; name: string }[];
  units: "metric" | "imperial";
  saved: () => void;
}) {
  const { pending, error, run } = useMutation();
  const [draft, setDraft] = useState<Record<string, unknown>>({
    ...values,
    ...(section === "goals"
      ? {
          goal_weight_kg:
            Number(values.goal_weight_kg) *
            (units === "imperial" ? 2.2046226218 : 1),
        }
      : {}),
  });
  const config = sectionFields[section];
  const warnings =
    section === "macros"
      ? macroWarnings(
          Object.fromEntries(
            ["calories", "protein", "carbs", "fat", "fiber"].map((k) => [
              k,
              Number(draft[k]),
            ]),
          ) as Macros,
        )
      : [];
  const [ack, setAck] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const next = { ...draft };
        for (const field of config.fields) {
          if (field.type === "list")
            next[field.key] = Array.isArray(next[field.key])
              ? next[field.key]
              : String(next[field.key])
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
          if (
            field.type === "number" ||
            ["cooking_minutes", "complexity"].includes(field.key)
          )
            next[field.key] = Number(next[field.key]);
        }
        if (section === "goals")
          next.goal_weight_kg =
            Number(next.goal_weight_kg) /
            (units === "imperial" ? 2.2046226218 : 1);
        if (section === "units")
          next.display_units_override = next.display_units_override || null;
        if (section === "macros") {
          next.source = "manual";
          next.warnings_acknowledged_at = ack ? new Date().toISOString() : null;
        }
        run(
          () =>
            savePreferences({
              section,
              data: next,
              expected: values,
              acknowledged: ack,
            }),
          saved,
        );
      }}
    >
      {section === "stores" ? (
        <div className="store-checkboxes">
          {stores.map((s) => (
            <label key={s.id}>
              <input
                type="checkbox"
                checked={(draft.stores as string[]).includes(s.id)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    stores: (e.target.checked
                      ? [...(draft.stores as string[]), s.id]
                      : (draft.stores as string[]).filter((id) => id !== s.id)
                    ).sort(),
                  })
                }
              />
              {s.name}
            </label>
          ))}
        </div>
      ) : (
        config.fields.map((field) => (
          <label className="field" key={field.key}>
            {field.key === "goal_weight_kg"
              ? `Goal weight (${units === "imperial" ? "lb" : "kg"})`
              : field.label}
            {field.type === "select" ? (
              <select
                value={String(draft[field.key] ?? "")}
                onChange={(e) =>
                  setDraft({ ...draft, [field.key]: e.target.value })
                }
              >
                {field.options?.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === "number" ? "number" : "text"}
                min={
                  field.key === "goal_weight_kg"
                    ? field.min! * (units === "imperial" ? 2.2046226218 : 1)
                    : field.min
                }
                max={
                  field.key === "goal_weight_kg"
                    ? field.max! * (units === "imperial" ? 2.2046226218 : 1)
                    : field.max
                }
                step={field.step || "any"}
                required={field.type !== "list"}
                value={
                  Array.isArray(draft[field.key])
                    ? (draft[field.key] as string[]).join(", ")
                    : String(draft[field.key] ?? "")
                }
                onChange={(e) =>
                  setDraft({ ...draft, [field.key]: e.target.value })
                }
              />
            )}
          </label>
        ))
      )}
      {section === "diet" && (
        <p className="fine-print muted">
          Supported dietary patterns: vegan, vegetarian, gluten-free,
          lactose-free, halal, kosher. Put allergies and individual food
          exclusions in “Ingredients to exclude.”
        </p>
      )}
      {warnings.length > 0 && (
        <>
          <ul className="notice">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <label>
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />{" "}
            I understand these target warnings.
          </label>
        </>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <Button disabled={pending}>
        {pending ? "Saving…" : `Save ${config.title.toLowerCase()}`}
      </Button>
    </form>
  );
}
