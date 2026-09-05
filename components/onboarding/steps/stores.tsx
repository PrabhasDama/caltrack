"use client";
import type { StepProps } from "./types";
import { Choices } from "../controls";
import type { OnboardingData } from "@/lib/validation/onboarding";
import { Check } from "lucide-react";
export function StoresStep({ data, set, stores }: StepProps) {
  return (
    <>
      <label className="field">
        ZIP code
        <input
          value={data.zip}
          onChange={(e) => set("zip", e.target.value)}
          inputMode="numeric"
          pattern="[0-9]{5}"
          maxLength={5}
          required
          autoComplete="postal-code"
          placeholder="90210"
        />
        <small>US grocery preferences. Precise location isn’t needed.</small>
      </label>
      <div>
        <span className="field-label">
          Your preferred stores · choose at least one
        </span>
        <div className="chip-grid">
          {stores.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={data.stores.includes(s.id)}
              className={`chip ${data.stores.includes(s.id) ? "selected" : ""}`}
              onClick={() =>
                set(
                  "stores",
                  data.stores.includes(s.id)
                    ? data.stores.filter((id) => id !== s.id)
                    : [...data.stores, s.id],
                )
              }
            >
              {data.stores.includes(s.id) && <Check size={13} />} {s.name}
            </button>
          ))}
        </div>
      </div>
      <Choices
        value={data.shoppingPreference}
        onChange={(v) =>
          set("shoppingPreference", v as OnboardingData["shoppingPreference"])
        }
        options={[
          ["cheapest", "Cheapest possible"],
          ["fewest", "Fewest stores"],
          ["balance", "Best balance"],
          ["closest", "Closest stores"],
        ]}
      />
    </>
  );
}
