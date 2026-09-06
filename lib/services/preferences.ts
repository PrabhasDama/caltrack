import "server-only";
import { requireProfile } from "./auth";
import { sectionSchemas, type Section } from "@/lib/preferences/sections";
export async function getPreferences() {
  const { client, user, profile } = await requireProfile();
  const tables = [
    "user_goals",
    "macro_targets",
    "budgets",
    "user_preferences",
    "store_preferences",
  ] as const;
  const results = await Promise.all(
    tables.map((t) => client.from(t).select("*").eq("user_id", user.id)),
  );
  if (results.some((r) => r.error))
    throw new Error("Preferences could not be loaded");
  const rows = Object.fromEntries(tables.map((t, i) => [t, results[i].data!]));
  const records: Record<Section, Record<string, unknown>> = {
    goals: rows.user_goals[0],
    macros: rows.macro_targets[0],
    budget: rows.budgets[0],
    cooking: rows.user_preferences[0],
    diet: rows.user_preferences[0],
    foods: rows.user_preferences[0],
    shopping: rows.user_preferences[0],
    training: rows.user_preferences[0],
    units: profile,
    profile,
    stores: { stores: rows.store_preferences.map((s) => s.store_id).sort() },
  };
  const data = Object.fromEntries(
    Object.entries(records).map(([section, row]) => [
      section,
      Object.fromEntries(
        Object.keys(sectionSchemas[section as Section].shape).map((k) => [
          k,
          row[k] ?? null,
        ]),
      ),
    ]),
  ) as Record<Section, Record<string, unknown>>;
  const { data: stores, error } = await client
    .from("stores")
    .select("id,name")
    .order("name");
  if (error) throw new Error("Stores could not be loaded");
  return {
    data,
    stores: stores || [],
    units: profile.units as "imperial" | "metric",
  };
}
