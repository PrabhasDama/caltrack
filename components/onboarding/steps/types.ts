import type { Dispatch, SetStateAction } from "react";
import type { OnboardingData } from "@/lib/validation/onboarding";
import type { estimateMacros, Macros } from "@/lib/nutrition/macros";
export type StepProps = {
  data: OnboardingData;
  set: <K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K],
  ) => void;
  setData: Dispatch<SetStateAction<OnboardingData>>;
  changeUnits: (units: "imperial" | "metric") => void;
  estimate: ReturnType<typeof estimateMacros>;
  targets: Macros;
  warnings: string[];
  stores: { id: string; name: string }[];
};
