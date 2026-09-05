import { z } from "zod";
import { isTimeZone } from "@/lib/date";
import { toKg, toCm } from "@/lib/nutrition/units";
export const macrosSchema = z.object({
  calories: z.number().int().min(1200).max(8000),
  protein: z.number().min(20).max(500),
  carbs: z.number().min(0).max(1200),
  fat: z.number().min(10).max(400),
  fiber: z.number().min(0).max(100),
});
const list = z.array(z.string().trim().min(1).max(80)).max(40);
export const onboardingSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name.").max(80),
    units: z.enum(["imperial", "metric"]),
    weight: z.number().positive(),
    height: z.number().positive(),
    age: z
      .number()
      .int()
      .min(18, "CalTrack calorie estimates are for adults 18 and over.")
      .max(100),
    sex: z.enum(["male", "female", "unspecified"]),
    timezone: z.string().refine(isTimeZone, "Select a valid time zone."),
    goal: z.enum(["lose", "recomp", "maintain", "build"]),
    goalWeight: z.number().positive(),
    pace: z.enum(["conservative", "moderate", "aggressive", "no_deadline"]),
    activity: z.enum(["sedentary", "light", "moderate", "very"]),
    workoutDays: z.number().int().min(0).max(7),
    trainingTypes: list,
    macroMode: z.enum(["recommended", "manual"]),
    macros: macrosSchema,
    waterMl: z.number().int().min(500).max(6000),
    budget: z.number().min(20).max(10000),
    shoppingFrequency: z.enum([
      "weekly",
      "twice_monthly",
      "monthly",
      "flexible",
    ]),
    zip: z.string().regex(/^\d{5}$/, "Enter a five-digit US ZIP code."),
    stores: z
      .array(z.string().uuid())
      .min(1, "Select at least one store.")
      .max(20),
    shoppingPreference: z.enum(["cheapest", "fewest", "balance", "closest"]),
    proteins: list,
    carbs: list,
    vegetables: list,
    fiberFoods: list,
    restrictions: list,
    excluded: list,
    disliked: list,
    complexity: z.number().int().min(1).max(3),
    cookingMinutes: z.union([
      z.literal(10),
      z.literal(20),
      z.literal(30),
      z.literal(60),
    ]),
    prepFrequency: z.enum(["daily", "twice_weekly", "weekly", "flexible"]),
    mealsPerDay: z.number().int().min(2).max(5),
    repeatTolerance: z.enum(["repeat", "some", "variety"]),
    acknowledged: z.boolean(),
  })
  .superRefine((d, ctx) => {
    for (const key of ["weight", "goalWeight"] as const)
      if (toKg(d[key], d.units) < 25 || toKg(d[key], d.units) > 500)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Weight must be between 25 and 500 kg (55–1,102 lb).",
        });
    if (toCm(d.height, d.units) < 100 || toCm(d.height, d.units) > 250)
      ctx.addIssue({
        code: "custom",
        path: ["height"],
        message: "Height must be between 100 and 250 cm (39–98 in).",
      });
  });
export type OnboardingData = z.infer<typeof onboardingSchema>;
export const defaultOnboarding: OnboardingData = {
  firstName: "",
  units: "imperial",
  weight: 165,
  height: 68,
  age: 30,
  sex: "unspecified",
  timezone: "America/Los_Angeles",
  goal: "recomp",
  goalWeight: 165,
  pace: "moderate",
  activity: "light",
  workoutDays: 3,
  trainingTypes: [],
  macroMode: "recommended",
  macros: { calories: 2100, protein: 130, carbs: 250, fat: 64, fiber: 29 },
  waterMl: 3000,
  budget: 300,
  shoppingFrequency: "weekly",
  zip: "",
  stores: [],
  shoppingPreference: "balance",
  proteins: [],
  carbs: [],
  vegetables: [],
  fiberFoods: [],
  restrictions: [],
  excluded: [],
  disliked: [],
  complexity: 2,
  cookingMinutes: 30,
  prepFrequency: "weekly",
  mealsPerDay: 3,
  repeatTolerance: "some",
  acknowledged: false,
};
export function stepSchema(step: number) {
  const keys: Record<number, string[]> = {
    1: ["firstName", "units", "weight", "height", "age", "sex", "timezone"],
    2: ["goal", "goalWeight", "pace"],
    3: ["activity", "workoutDays", "trainingTypes"],
    4: ["macroMode", "macros", "waterMl"],
    5: ["budget", "shoppingFrequency"],
    6: ["zip", "stores", "shoppingPreference"],
    7: [
      "proteins",
      "carbs",
      "vegetables",
      "fiberFoods",
      "restrictions",
      "excluded",
      "disliked",
    ],
    8: [
      "complexity",
      "cookingMinutes",
      "prepFrequency",
      "mealsPerDay",
      "repeatTolerance",
    ],
  };
  return z.object(
    Object.fromEntries(
      (keys[step] || []).map((key) => [
        key,
        onboardingSchema.shape[key as keyof typeof onboardingSchema.shape],
      ]),
    ),
  );
}
