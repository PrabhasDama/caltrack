"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UploadForm } from "@/components/uploads/upload-form";
import { PrivateImage } from "@/components/uploads/private-image";
import { Button } from "@/components/ui/button";
import {
  saveReviewedLabel,
  extractLabel,
} from "@/app/(app)/scan/label/actions";
import type { LabelCandidate } from "@/lib/scanning/providers";
import type { UserUpload } from "@/lib/uploads/types";
export function LabelScanner({
  today,
  uploads,
}: {
  today: string;
  uploads: UserUpload[];
}) {
  const [id, setId] = useState<string | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    router = useRouter();
  const [loading, setLoading] = useState(false),
    [candidate, setCandidate] = useState<LabelCandidate>({}),
    [message, setMessage] = useState("");
  async function openReview(next: string) {
    setLoading(true);
    setError("");
    try {
      const r = await extractLabel(next);
      setCandidate(r.candidate || {});
      setMessage(
        r.status === "unavailable"
          ? r.message
          : `Candidate values from ${r.provider}. Verify and edit every field before saving.`,
      );
      setId(next);
      setSaved(false);
      router.refresh();
    } catch {
      setError("Could not load the image for review. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="secondary-page">
      <header className="page-title">
        <span className="eyebrow">LABEL → REVIEW → YOUR FOOD LIBRARY</span>
        <h1>A little help with the label.</h1>
        <p>
          Use a label image to enter and review your food’s nutrition. You
          confirm every value.
        </p>
      </header>
      {error && !id && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Preparing your review…</p>
      ) : !id ? (
        <section className="card">
          <h2>Scan Nutrition Label</h2>
          <UploadForm
            bucket="nutrition-labels"
            today={today}
            onSaved={openReview}
          />
          {!!uploads.length && (
            <label className="field">
              Continue a previous label
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    void openReview(e.target.value);
                  }
                }}
              >
                <option value="">Choose an uploaded image</option>
                {uploads.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.local_date} · {u.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
      ) : saved ? (
        <section className="card">
          <h2>Reviewed food saved</h2>
          <p>
            This private food and its nutrition are now available in your food
            library, pantry, and manual purchase matching. No food has been
            logged as eaten.
          </p>
          <Link href="/dashboard" className="button">
            Back to Today →
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              setId(null);
              setSaved(false);
            }}
          >
            Review another label
          </Button>
        </section>
      ) : (
        <section className="card scan-review">
          <div>
            <h2>Review the nutrition label</h2>
            <PrivateImage id={id} alt="Nutrition label being reviewed" />
            <p className="notice">
              {message} Blank fields are not treated as zero.
            </p>
          </div>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const optional = (key: string) =>
                f.get(key) === "" ? null : Number(f.get(key));
              setPending(true);
              setError("");
              try {
                const r = await saveReviewedLabel(id, {
                  name: f.get("name"),
                  servingSize: Number(f.get("servingSize")),
                  servingUnit: f.get("servingUnit"),
                  servingGrams: Number(f.get("servingGrams")),
                  servingsPerContainer: optional("servingsPerContainer"),
                  calories: Number(f.get("calories")),
                  protein: Number(f.get("protein")),
                  carbs: Number(f.get("carbs")),
                  fat: Number(f.get("fat")),
                  fiber: Number(f.get("fiber")),
                  sugar: optional("sugar"),
                  sodium: optional("sodium"),
                  confirmed: f.get("confirmed") === "on",
                });
                if (r.error) setError(r.error);
                else {
                  setSaved(true);
                  router.refresh();
                }
              } catch {
                setError(
                  "Could not save the label. Your reviewed values are still here; please retry.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            <label className="field">
              Food / product name
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={candidate.name ?? ""}
              />
            </label>
            <div className="form-grid">
              <label className="field">
                Serving size
                <input
                  name="servingSize"
                  defaultValue={candidate.servingSize ?? ""}
                  type="number"
                  step="any"
                  min=".001"
                  required
                />
              </label>
              <label className="field">
                Serving unit
                <input
                  name="servingUnit"
                  defaultValue={candidate.servingUnit ?? ""}
                  placeholder="g, pieces, scoop…"
                  maxLength={30}
                  required
                />
              </label>
              <label className="field">
                Weight of that serving (g)
                <input
                  name="servingGrams"
                  defaultValue={candidate.servingGrams ?? ""}
                  type="number"
                  step="any"
                  min=".001"
                  required
                />
              </label>
              <label className="field">
                Servings per container (optional)
                <input
                  name="servingsPerContainer"
                  defaultValue={candidate.servingsPerContainer ?? ""}
                  type="number"
                  step="any"
                  min=".001"
                />
              </label>
            </div>
            <p className="fine-print muted">
              A known gram weight is needed to use serving-based nutrition
              accurately. Volume alone is not converted without a food-specific
              weight.
            </p>
            <div className="form-grid">
              {[
                "calories",
                "protein",
                "carbs",
                "fat",
                "fiber",
                "sugar",
                "sodium",
              ].map((k) => (
                <label key={k} className="field">
                  {k[0].toUpperCase() + k.slice(1)} per serving (
                  {k === "calories" ? "kcal" : k === "sodium" ? "mg" : "g"})
                  {["sugar", "sodium"].includes(k) ? " · optional" : ""}
                  <input
                    name={k}
                    defaultValue={candidate[k as keyof LabelCandidate] ?? ""}
                    type="number"
                    step="any"
                    min="0"
                    required={!["sugar", "sodium"].includes(k)}
                  />
                </label>
              ))}
            </div>
            <label className="review-confirm">
              <input name="confirmed" type="checkbox" required />I reviewed the
              image, serving weight, and every entered value.
            </label>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <Button disabled={pending}>
              {pending ? "Saving…" : "Confirm and save food"}
            </Button>
          </form>
        </section>
      )}
      <Link href="/dashboard" className="text-link">
        Back to A Little Extra →
      </Link>
    </div>
  );
}
