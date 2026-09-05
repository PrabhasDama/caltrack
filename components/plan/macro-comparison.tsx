import type { Macros } from "@/lib/nutrition/macros";
export function MacroComparison({
  actual,
  target,
}: {
  actual: Macros;
  target: Macros;
}) {
  return (
    <div className="target-comparison">
      {(["calories", "protein", "carbs", "fat", "fiber"] as const).map((k) => (
        <div key={k}>
          <span>
            {k === "calories" ? "Calories" : k[0].toUpperCase() + k.slice(1)}
          </span>
          <strong>
            {Math.round(actual[k]).toLocaleString()}
            <small> / {target[k].toLocaleString()}</small>
          </strong>
          <div className="meter-track">
            <i
              style={{
                width: `${Math.min(100, (actual[k] / Math.max(1, target[k])) * 100)}%`,
              }}
            />
          </div>
          <small>
            {k === "calories" ? "kcal" : "grams"} · planned / target
          </small>
        </div>
      ))}
    </div>
  );
}
