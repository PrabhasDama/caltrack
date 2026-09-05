"use client";
import type { StepProps } from "./types";
import { Multi } from "../controls";
import {
  proteins,
  carbs,
  vegetables,
  fiberFoods,
  restrictions,
} from "../options";
import type { OnboardingData } from "@/lib/validation/onboarding";
export function FoodsStep({ data, set }: StepProps) {
  return (
    <>
      {(
        [
          ["proteins", "Preferred proteins", proteins],
          ["carbs", "Preferred carbohydrates", carbs],
          ["vegetables", "Vegetables", vegetables],
          ["fiberFoods", "Fiber-rich foods", fiberFoods],
          [
            "restrictions",
            "Dietary restrictions · leave blank for none",
            restrictions,
          ],
        ] as [keyof OnboardingData, string, string[]][]
      ).map(([key, label, options]) => (
        <div key={key}>
          <span className="field-label">{label}</span>
          <Multi
            values={data[key] as string[]}
            options={options}
            onChange={(v) => set(key, v)}
          />
        </div>
      ))}
      <label className="field">
        Ingredients to exclude
        <textarea
          defaultValue={data.excluded.join(", ")}
          onBlur={(e) =>
            set(
              "excluded",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          placeholder="Peanuts, shellfish…"
          maxLength={2000}
        />
        <small>
          Separate with commas. Exclusions take priority over favorites.
          CalTrack cannot certify packaged foods as allergen-free.
        </small>
      </label>
      <label className="field">
        Foods you dislike
        <textarea
          defaultValue={data.disliked.join(", ")}
          onBlur={(e) =>
            set(
              "disliked",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          placeholder="Anything you would rather leave out"
          maxLength={2000}
        />
      </label>
    </>
  );
}
