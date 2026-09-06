"use client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { fromKg } from "@/lib/nutrition/units";
import { formatDate } from "@/lib/date";
import type { WeightEntry } from "@/types/domain";
import { weightTrend } from "@/lib/progress/analytics";
export function WeightChart({
  entries,
  units,
  goal,
  compact = false,
  since,
}: {
  entries: WeightEntry[];
  units: "imperial" | "metric";
  goal?: number;
  compact?: boolean;
  since?: string;
}) {
  const points = weightTrend(entries)
    .filter((w) => !since || w.local_date >= since)
    .map((w) => ({
      date: w.local_date,
      weight: Number(fromKg(w.weight_kg, units).toFixed(1)),
      trend: Number(fromKg(w.trend, units).toFixed(1)),
    }));
  return (
    <div
      style={{ height: compact ? 80 : 280, width: "100%", minWidth: 0 }}
      aria-label={`Weight history in ${units === "imperial" ? "pounds" : "kilograms"}`}
      role="img"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{
            top: 10,
            right: compact ? 5 : 20,
            bottom: 0,
            left: compact ? 5 : 0,
          }}
        >
          {!compact && (
            <>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) =>
                  formatDate(v, { month: "short", day: "numeric" })
                }
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                minTickGap={30}
              />
              <YAxis
                domain={["auto", "auto"]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                width={45}
              />
              <Tooltip
                labelFormatter={(v) => formatDate(String(v))}
                contentStyle={{
                  borderRadius: 10,
                  borderColor: "var(--border)",
                  background: "var(--card)",
                  fontSize: 12,
                }}
              />
              {goal && (
                <ReferenceLine
                  ifOverflow="extendDomain"
                  y={fromKg(goal, units)}
                  stroke="var(--muted)"
                  strokeDasharray="3 3"
                  label={{ value: "Goal", fontSize: 10, fill: "var(--muted)" }}
                />
              )}
            </>
          )}
          <Line
            type="monotone"
            name="Weight"
            dataKey="weight"
            stroke={compact ? "var(--primary)" : "#adbb9f"}
            strokeWidth={compact ? 2 : 1}
            dot={!compact ? { r: 3, fill: "var(--primary)" } : false}
            isAnimationActive={false}
          />
          {!compact && (
            <Line
              type="monotone"
              name="7-day trend"
              dataKey="trend"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
