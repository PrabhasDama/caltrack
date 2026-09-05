export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};
export type EstimateInput = {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "male" | "female" | "unspecified";
  activity: "sedentary" | "light" | "moderate" | "very";
  goal: "lose" | "recomp" | "maintain" | "build";
  pace: "conservative" | "moderate" | "aggressive" | "no_deadline";
};
export const activityFactors = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
};
export function estimateMacros(input: EstimateInput) {
  // Mifflin–St Jeor. The midpoint is used only when the optional sex input is omitted.
  const sexOffset =
    input.sex === "male" ? 5 : input.sex === "female" ? -161 : -78;
  const bmr =
    10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + sexOffset;
  const maintenance = Math.round(bmr * activityFactors[input.activity]);
  const deficit = {
    conservative: 0.1,
    moderate: 0.15,
    aggressive: 0.2,
    no_deadline: 0.1,
  }[input.pace];
  const factor =
    input.goal === "lose"
      ? 1 - deficit
      : input.goal === "recomp"
        ? 0.95
        : input.goal === "build"
          ? 1.08
          : 1;
  // App safety floor, not a claim of individual nutritional adequacy.
  const calories = Math.max(
    1500,
    Math.min(6000, Math.round((maintenance * factor) / 10) * 10),
  );
  const protein = Math.round(
    Math.min(
      input.weightKg * (input.goal === "maintain" ? 1.4 : 1.6),
      (calories * 0.3) / 4,
    ),
  );
  const fat = Math.round((calories * 0.28) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  const fiber = Math.round((calories / 1000) * 14);
  return {
    targets: { calories, protein, carbs, fat, fiber },
    bmr: Math.round(bmr),
    maintenance,
    factor,
    activityFactor: activityFactors[input.activity],
  };
}
export function macroWarnings(m: Macros) {
  const warnings: string[] = [];
  if (m.calories < 1500)
    warnings.push(
      "This calorie target is low. Consider increasing it and discussing your needs with a qualified clinician.",
    );
  if (m.protein * 4 > m.calories * 0.35)
    warnings.push(
      "Protein supplies over 35% of your calories. Consider a more balanced target.",
    );
  if (m.fat * 9 < m.calories * 0.2)
    warnings.push(
      "Fat supplies less than 20% of your calories. Consider increasing it.",
    );
  if (m.fiber < 20)
    warnings.push(
      "Fiber is low. Consider more fiber-rich foods and increase gradually.",
    );
  if (
    Math.abs(m.protein * 4 + m.carbs * 4 + m.fat * 9 - m.calories) >
    m.calories * 0.15
  )
    warnings.push(
      "Your macro grams and calorie target differ by more than 15%. Check your entries.",
    );
  if (m.calories > 4500)
    warnings.push(
      "This calorie target is high. Check that it matches your individual needs.",
    );
  return warnings;
}
export const emptyMacros: Macros = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
};
export function sumMacros(items: Macros[]): Macros {
  return items.reduce(
    (sum, item) => ({
      calories: sum.calories + Number(item.calories),
      protein: sum.protein + Number(item.protein),
      carbs: sum.carbs + Number(item.carbs),
      fat: sum.fat + Number(item.fat),
      fiber: sum.fiber + Number(item.fiber),
    }),
    { ...emptyMacros },
  );
}
