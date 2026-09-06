"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Leaf,
  Target,
  Activity,
  Utensils,
  Wallet,
  MapPin,
  ChefHat,
  CheckCircle2,
} from "lucide-react";
import {
  defaultOnboarding,
  type OnboardingData,
} from "@/lib/validation/onboarding";
import { estimateMacros, macroWarnings } from "@/lib/nutrition/macros";
import { toKg, toCm, fromKg } from "@/lib/nutrition/units";
import { saveOnboardingStep, finishOnboarding } from "@/app/onboarding/actions";
import { stepTitles, stepLabels } from "./options";
import { BasicsStep } from "./steps/basics";
import { GoalStep } from "./steps/goal";
import { ActivityStep } from "./steps/activity";
import { MacrosStep } from "./steps/macros";
import { BudgetStep } from "./steps/budget";
import { StoresStep } from "./steps/stores";
import { FoodsStep } from "./steps/foods";
import { CookingStep } from "./steps/cooking";
import { SummaryStep } from "./steps/summary";
const icons = [
  Leaf,
  Target,
  Activity,
  Utensils,
  Wallet,
  MapPin,
  Leaf,
  ChefHat,
  CheckCircle2,
];
export function OnboardingWizard({
  draft,
  initialStep,
  complete,
  stores,
}: {
  draft: Partial<OnboardingData>;
  initialStep: number;
  complete: boolean;
  stores: { id: string; name: string }[];
}) {
  const [data, setData] = useState<OnboardingData>({
    ...defaultOnboarding,
    ...draft,
    macros: { ...defaultOnboarding.macros, ...draft.macros },
  });
  const [step, setStep] = useState(complete ? 1 : initialStep);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function set<K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K],
  ) {
    setData((d) => ({
      ...d,
      [key]: value,
      acknowledged: key === "acknowledged" ? (value as boolean) : false,
    }));
    setSaved("");
    setError("");
  }
  const estimate = estimateMacros({
    weightKg: toKg(data.weight, data.units),
    heightCm: toCm(data.height, data.units),
    age: data.age,
    sex: data.sex,
    activity: data.activity,
    goal: data.goal,
    pace: data.pace,
  });
  const targets =
    data.macroMode === "recommended" ? estimate.targets : data.macros;
  const warnings = macroWarnings(targets);
  if (data.pace === "aggressive")
    warnings.push(
      "An aggressive pace may be harder to sustain. Consider a conservative or moderate approach.",
    );
  const Icon = icons[step - 1];
  function save(exit = false) {
    setError("");
    startTransition(async () => {
      try {
        const payload = { ...data, macros: targets };
        const result =
          step === 9
            ? await finishOnboarding(payload)
            : await saveOnboardingStep(payload, step);
        if (result.error) {
          setError(result.error);
          return;
        }
        setSaved("Progress saved");
        if (step === 9 || exit) {
          router.push(step === 9 ? "/dashboard" : "/profile");
          router.refresh();
        } else {
          setStep((s) => s + 1);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch {
        setError("We couldn’t save this step. Please try again.");
      }
    });
  }
  function changeUnits(units: "imperial" | "metric") {
    if (units === data.units) return;
    setData((d) => ({
      ...d,
      units,
      weight: Number(fromKg(toKg(d.weight, d.units), units).toFixed(1)),
      goalWeight: Number(fromKg(toKg(d.goalWeight, d.units), units).toFixed(1)),
      height: Number(
        (units === "imperial"
          ? toCm(d.height, d.units) / 2.54
          : toCm(d.height, d.units)
        ).toFixed(1),
      ),
      acknowledged: false,
    }));
  }
  const stepProps = {
    data,
    set,
    setData,
    changeUnits,
    estimate,
    targets,
    warnings,
    stores,
  };
  return (
    <div className="onboarding">
      <aside className="onboarding-sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">c</span>caltrack.
        </Link>
        <div className="onboarding-heading">
          <span className="eyebrow">LET’S MAKE IT PERSONAL</span>
          <h2>
            Built around
            <br />
            your real life.
          </h2>
          <p>Nine small steps to a stronger foundation.</p>
        </div>
        <ol className="step-list">
          {stepLabels.map((label, i) => (
            <li
              className={i + 1 === step ? "active" : i + 1 < step ? "done" : ""}
              key={label}
            >
              <span>
                {i + 1 < step ? (
                  <Check size={13} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <div className="onboarding-privacy">
          <Leaf size={18} />
          <p>
            Your goals are personal.
            <br />
            Your data stays private.
          </p>
        </div>
      </aside>
      <main id="main" className="onboarding-main">
        <header className="onboarding-top">
          <span>YOUR PERSONAL PLAN</span>
          <span>STEP {String(step).padStart(2, "0")} OF 09</span>
        </header>
        <div className="onboarding-progress">
          <span style={{ width: `${(step / 9) * 100}%` }} />
        </div>
        <section className="wizard-body onboarding-step" key={step}>
          <div className="wizard-icon">
            <Icon size={23} />
          </div>
          <div className="page-title">
            <h1>{stepTitles[step - 1]}</h1>
            <p>
              {
                [
                  "Just the essentials. You can adjust these later.",
                  "Choose what matters to you. No promised deadlines.",
                  "Think about an ordinary week, not your busiest one.",
                  "A starting point, with room to make it yours.",
                  "A monthly amount you feel comfortable with.",
                  "Save your preferences for future grocery planning.",
                  "Choose favorites and tell us what to leave out.",
                  "Keep the routine realistic for your week.",
                  "Review your choices before you start tracking.",
                ][step - 1]
              }
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="form-stack wizard-form"
          >
            {step === 1 && <BasicsStep {...stepProps} />}
            {step === 2 && <GoalStep {...stepProps} />}
            {step === 3 && <ActivityStep {...stepProps} />}
            {step === 4 && <MacrosStep {...stepProps} />}
            {step === 5 && <BudgetStep {...stepProps} />}
            {step === 6 && <StoresStep {...stepProps} />}
            {step === 7 && <FoodsStep {...stepProps} />}
            {step === 8 && <CookingStep {...stepProps} />}
            {step === 9 && <SummaryStep {...stepProps} />}
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <div className="wizard-actions">
              <button
                type="button"
                className="button"
                disabled={pending || step === 1}
                onClick={() => {
                  setStep((s) => s - 1);
                  setError("");
                }}
              >
                <ArrowLeft size={15} /> Back
              </button>
              <span role="status" className="save-status">
                {saved || "Saved when you continue"}
              </span>
              <button className="button primary" disabled={pending}>
                {pending
                  ? "Saving…"
                  : step === 9
                    ? "Start my daily rhythm"
                    : "Save & continue"}
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
          {complete && (
            <Link
              href="/dashboard"
              className="text-link"
              style={{ display: "block", marginTop: 25 }}
            >
              Return to Today
            </Link>
          )}
        </section>
      </main>
    </div>
  );
}
