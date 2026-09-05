"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/services/auth";
import { onboardingSchema, stepSchema } from "@/lib/validation/onboarding";
import { estimateMacros, macroWarnings } from "@/lib/nutrition/macros";
import { toKg, toCm } from "@/lib/nutrition/units";
export async function saveOnboardingStep(input: unknown, step: number) {
  const { client, user } = await requireProfile(false);
  const validStep = z.number().int().min(1).max(9).safeParse(step);
  if (!validStep.success) return { error: "Invalid step." };
  // Validate all submitted field shapes, permitting not-yet-completed steps.
  const shape = z.object(onboardingSchema.shape).partial().safeParse(input);
  if (!shape.success) {
    const issue = shape.error.issues.find((i) =>
      Object.keys(stepSchema(step).shape).includes(String(i.path[0])),
    );
    if (issue) return { error: issue.message };
  }
  const current = stepSchema(step).safeParse(input);
  if (!current.success) return { error: current.error.issues[0].message };
  if (
    !input ||
    typeof input !== "object" ||
    JSON.stringify(input).length > 20000
  )
    return { error: "The saved form is too large." };
  // Only known keys survive. Incomplete strings on future steps remain safe private JSON.
  const draft = Object.fromEntries(
    Object.keys(onboardingSchema.shape)
      .filter((key) => key in input)
      .map((key) => [key, (input as Record<string, unknown>)[key]]),
  );
  if (
    (step === 1 || step === 2) &&
    draft.units &&
    typeof draft.weight === "number" &&
    typeof draft.height === "number" &&
    typeof draft.goalWeight === "number"
  ) {
    const units = draft.units as "imperial" | "metric";
    if (
      toKg(step === 1 ? draft.weight : draft.goalWeight, units) < 25 ||
      toKg(step === 1 ? draft.weight : draft.goalWeight, units) > 500
    )
      return { error: "Weight must be between 25 and 500 kg (55–1,102 lb)." };
    if (
      step === 1 &&
      (toCm(draft.height, units) < 100 || toCm(draft.height, units) > 250)
    )
      return { error: "Height must be between 100 and 250 cm (39–98 in)." };
  }
  const { error } = await client
    .from("profiles")
    .update({ onboarding_draft: draft, onboarding_step: Math.min(step + 1, 9) })
    .eq("id", user.id);
  return error
    ? { error: "Your progress could not be saved. Please retry." }
    : { success: true };
}
export async function finishOnboarding(input: unknown) {
  const { client } = await requireProfile(false);
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.macroMode === "recommended")
    d.macros = estimateMacros({
      weightKg: toKg(d.weight, d.units),
      heightCm: toCm(d.height, d.units),
      age: d.age,
      sex: d.sex,
      activity: d.activity,
      goal: d.goal,
      pace: d.pace,
    }).targets;
  const warnings = macroWarnings(d.macros);
  if ((warnings.length || d.pace === "aggressive") && !d.acknowledged)
    return {
      error: "Please acknowledge the guidance before saving these targets.",
    };
  const { error } = await client.rpc("save_onboarding", { p_data: d });
  if (error)
    return {
      error: "We couldn’t save your plan. Check your inputs and try again.",
    };
  revalidatePath("/", "layout");
  return { success: true };
}
