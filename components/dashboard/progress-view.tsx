"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Scale, Plus } from "lucide-react";
import { formatWeight, fromKg } from "@/lib/nutrition/units";
import { formatDate, addDays } from "@/lib/date";
import { weightProgress } from "@/lib/analytics/daily";
import { WeightDialog } from "./tracking-forms";
import { Button } from "@/components/ui/button";
import type { DashboardData } from "@/types/domain";
const WeightChart = dynamic(
  () => import("./weight-chart").then((m) => m.WeightChart),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 280 }} role="status">
        Loading your chart…
      </div>
    ),
  },
);
export function ProgressView({ data }: { data: DashboardData }) {
  const [range, setRange] = useState(30);
  const weights = data.weights.filter(
    (w) => range === 0 || w.local_date >= addDays(data.today, -range + 1),
  );
  const current =
    data.weights.at(-1)?.weight_kg ?? data.profile.starting_weight_kg;
  const progress = weightProgress(
    data.profile.starting_weight_kg,
    current,
    data.goal.goal_weight_kg,
  );
  return (
    <div className="secondary-page">
      <header className="dashboard-heading">
        <div className="page-title">
          <span className="eyebrow">ONE CHECK-IN AT A TIME</span>
          <h1>
            See the bigger picture<span className="brand-dot">.</span>
          </h1>
          <p>
            Everyday fluctuations are normal. Your history gives them context.
          </p>
        </div>
        <WeightDialog
          date={data.today}
          units={data.profile.units}
          weight={
            data.weights.find((w) => w.local_date === data.today)?.weight_kg
          }
        >
          <Button>
            <Plus size={15} /> Log weight
          </Button>
        </WeightDialog>
      </header>
      <div className="progress-stats">
        {[
          [
            "Starting weight",
            formatWeight(data.profile.starting_weight_kg, data.profile.units),
          ],
          [
            "Latest weight",
            data.weights.length
              ? formatWeight(current, data.profile.units)
              : "—",
          ],
          [
            "Goal weight",
            formatWeight(data.goal.goal_weight_kg, data.profile.units),
          ],
          [
            "Total change",
            data.weights.length
              ? `${progress.change > 0 ? "+" : ""}${fromKg(progress.change, data.profile.units).toFixed(1)} ${data.profile.units === "imperial" ? "lb" : "kg"}`
              : "—",
          ],
        ].map(([label, value]) => (
          <div className="card" key={label}>
            <span className="label">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="card">
        <div className="section-heading">
          <h2>Your weight history</h2>
          <div className="range-tabs">
            {[7, 30, 90, 0].map((v) => (
              <button
                key={v}
                className={range === v ? "active" : ""}
                aria-pressed={range === v}
                onClick={() => setRange(v)}
              >
                {v ? `${v}D` : "1Y"}
              </button>
            ))}
          </div>
        </div>
        {weights.length ? (
          <>
            <WeightChart
              entries={weights}
              units={data.profile.units}
              goal={data.goal.goal_weight_kg}
            />
            <p className="fine-print muted">
              Dots show weigh-ins. The darker line averages your latest seven
              entries; it is not necessarily a seven-day average. Up to one year
              of records is shown.
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
      {weights.length > 0 && (
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
                <strong>{formatWeight(w.weight_kg, data.profile.units)}</strong>
                <WeightDialog
                  date={w.local_date}
                  units={data.profile.units}
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
