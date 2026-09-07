import { scorePlan, type Objective } from "./engine";
import type { PlanContext, PlanDay } from "@/lib/meal-plan/types";
/** Small in-memory cache keyed by authenticated owner and every deterministic input.
 * No disk persistence; no user can reuse another owner's entry. */
export function createScoreCache(limit = 8) {
  const entries = new Map<string, ReturnType<typeof scorePlan>>();
  return {
    clear: () => entries.clear(),
    get(days: PlanDay[], context: PlanContext, objective: Objective) {
      if (!context.ownerId) return scorePlan(days, context, objective);
      const key = JSON.stringify([context.ownerId, days, context, objective]);
      const old = entries.get(key);
      if (old) return old;
      const value = scorePlan(days, context, objective);
      entries.set(key, value);
      if (entries.size > limit) entries.delete(entries.keys().next().value!);
      return value;
    },
  };
}
export const optimizerCache = createScoreCache();
