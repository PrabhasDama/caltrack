"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/dashboard/use-mutation";
import {
  saveMeasurement,
  deleteMeasurement,
} from "@/app/(app)/progress/actions";
import {
  measurementNames,
  measurementFromCm,
  type BodyMeasurement,
} from "@/lib/progress/analytics";
export function MeasurementEditor({
  today,
  units,
  item,
}: {
  today: string;
  units: "imperial" | "metric";
  item?: BodyMeasurement;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useMutation();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          {item ? "Edit measurements" : "Add measurements"}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={item ? "Update measurements" : "A little more context"}
        description="Optional measurements, recorded in the same place each time. Leave any field blank."
      >
        {open && (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(
                () =>
                  saveMeasurement({
                    id: item?.id || crypto.randomUUID(),
                    updated_at: item?.updated_at,
                    local_date: f.get("date"),
                    notes: f.get("notes"),
                    ...Object.fromEntries(
                      measurementNames.map((k) => [
                        k,
                        f.get(k) === "" ? null : Number(f.get(k)),
                      ]),
                    ),
                  }),
                () => setOpen(false),
              );
            }}
          >
            <label className="field">
              Measurement date
              <input
                name="date"
                type="date"
                required
                max={today}
                defaultValue={item?.local_date || today}
              />
            </label>
            <div className="form-grid">
              {measurementNames.map((k) => (
                <label className="field" key={k}>
                  {k[0].toUpperCase() + k.slice(1)} (
                  {units === "imperial" ? "in" : "cm"})
                  <input
                    name={k}
                    type="number"
                    step="0.1"
                    min="0.4"
                    max={units === "imperial" ? 157 : 400}
                    defaultValue={
                      item?.[k]
                        ? measurementFromCm(Number(item[k]), units).toFixed(1)
                        : ""
                    }
                  />
                </label>
              ))}
            </div>
            <label className="field">
              Notes
              <textarea
                name="notes"
                maxLength={1000}
                defaultValue={item?.notes || ""}
              />
            </label>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <Button disabled={pending}>
              {pending ? "Saving…" : "Save measurements"}
            </Button>
            {item && (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  run(
                    () => deleteMeasurement(item.id),
                    () => setOpen(false),
                  )
                }
              >
                Delete measurements
              </Button>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
