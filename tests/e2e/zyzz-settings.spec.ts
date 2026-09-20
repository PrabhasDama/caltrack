import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const qa = JSON.parse(readFileSync(".env.qa-split", "utf8"));

test("existing-user settings save independently without replacing plans", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  const snapshot = async () => (await page.request.get("/api/export")).json();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preferences");
  for (const [section, label, value, table, field] of [
    ["goals", "Goal", "maintain", "user_goals", "goal"],
    [
      "macro targets",
      "Daily water target (mL)",
      "2700",
      "macro_targets",
      "water_ml",
    ],
    [
      "grocery budget",
      "Monthly grocery budget",
      "410",
      "budgets",
      "monthly_amount",
    ],
    [
      "food preferences",
      "Preferred proteins",
      "Eggs, Tofu",
      "user_preferences",
      "preferred_proteins",
    ],
    [
      "meals & cooking",
      "Cooking time",
      "30",
      "user_preferences",
      "cooking_minutes",
    ],
    [
      "country & measurement",
      "Measurement system",
      "metric",
      "profiles",
      "display_units_override",
    ],
  ]) {
    const before = await snapshot();
    await page
      .getByRole("button", { name: `Edit ${section}`, exact: true })
      .click();
    const role = ["Goal", "Cooking time", "Measurement system"].includes(label)
      ? "combobox"
      : label === "Preferred proteins"
        ? "textbox"
        : "spinbutton";
    const control = page.getByRole(role, { name: label, exact: true });
    const old = await control.inputValue();
    const select = await control.evaluate((e) => e.tagName === "SELECT");
    if (select) {
      const target =
        value !== old
          ? value
          : await control
              .locator("option")
              .evaluateAll(
                (options, current) =>
                  (options as HTMLOptionElement[]).find(
                    (o) => o.value !== current,
                  )!.value,
                old,
              );
      await control.selectOption(target);
    } else
      await control.fill(value !== old ? value : String(Number(value) + 10));
    const ack = page.getByLabel("I understand these target warnings.");
    if (await ack.isVisible()) await ack.check();
    await page
      .getByRole("button", { name: `Save ${section}`, exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(
      "existing plan is preserved",
    );
    const after = await snapshot();
    for (const key of [
      "daily_meal_logs",
      "meal_plan_days",
      "split_plans",
      "split_assignments",
      "pantry_items",
      "purchases",
      "location_preferences",
    ])
      expect(after[key], `${section} preserved ${key}`).toEqual(before[key]);
    for (const key of [
      "profiles",
      "user_goals",
      "user_preferences",
      "macro_targets",
      "budgets",
    ])
      if (key !== table)
        expect(after[key], `${section} preserved ${key}`).toEqual(before[key]);
    expect(
      JSON.stringify(
        after[table].map((r: Record<string, unknown>) => r[field]),
      ),
    ).not.toBe(
      JSON.stringify(
        before[table].map((r: Record<string, unknown>) => r[field]),
      ),
    );
    await page
      .getByRole("button", { name: `Edit ${section}`, exact: true })
      .click();
    const restored = page.getByRole(role, { name: label, exact: true });
    if (select) await restored.selectOption(old);
    else await restored.fill(old);
    if (await ack.isVisible()) await ack.check();
    await page
      .getByRole("button", { name: `Save ${section}`, exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  const before = await snapshot();
  await page
    .getByRole("button", { name: "Edit preferred stores", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "RALPHS", exact: true }).check();
  await page
    .getByRole("button", { name: "Save preferred stores", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#stores")).toContainText("RALPHS");
  const after = await snapshot();
  expect(after.daily_meal_logs).toEqual(before.daily_meal_logs);
  expect(after.split_plans).toEqual(before.split_plans);
  expect(after.macro_targets).toEqual(before.macro_targets);
  expect(after.budgets).toEqual(before.budgets);
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/preferences/);
});
