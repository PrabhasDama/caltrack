import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const qa = JSON.parse(readFileSync(".env.qa", "utf8"));

// Runs after core.spec.ts against the same isolated, completed test account.
test("measurement preferences, recipe review, pantry selection, and mobile dialogs", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const before = await (await page.request.get("/api/export")).json();
  try {
    await page.goto("/preferences");
    await page
      .getByRole("button", { name: "Edit country & measurement", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Country", exact: true })
      .selectOption("CA");
    await page
      .getByRole("combobox", { name: "Measurement system", exact: true })
      .selectOption("");
    await page
      .getByRole("button", { name: "Save country & measurement", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const metric = await (await page.request.get("/api/export")).json();
    expect(metric.profiles[0].units).toBe("metric");
    expect(metric.daily_meal_logs).toEqual(before.daily_meal_logs);
    expect(metric.macro_targets).toEqual(before.macro_targets);
    expect(metric.budgets).toEqual(before.budgets);
    await page.goto("/dashboard");
    await expect(page.locator(".meal-ingredients").first()).toContainText(
      "100 g Tofu",
    );
    await page.goto("/plan");
    await expect(page.locator(".ingredient-list").first()).not.toContainText(
      " oz",
    );
    await page.locator(".plan-week button").nth(1).click();
    await page.locator(".plan-meal summary").first().click();
    const recipe = page.locator(".plan-meal").first();
    await expect(recipe.locator("details")).toContainText("Prep");
    await expect(recipe.locator("details")).toContainText("Ingredient form");
    const recipeName = await recipe.locator("h3").innerText();
    const savedRecipe = before.daily_meal_logs.find(
      (m: { name: string; instructions: string[] }) => m.name === recipeName,
    );
    expect(savedRecipe.instructions.length).toBeGreaterThan(0);
    await expect(recipe.locator("ol li")).toHaveText(savedRecipe.instructions);
    await expect(recipe.locator("ol")).toHaveCSS("list-style-type", "decimal");
    await recipe.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/review-recipe-desktop.png" });
    await recipe
      .getByRole("button", { name: "Swap meal", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Higher Protein", exact: true })
      .click();
    await page.getByLabel("Search meals").fill("zz-no-matching-recipe");
    await expect(page.locator(".swap-options button")).toHaveCount(0);
    await page.getByLabel("Search meals").fill("tofu");
    await expect(page.locator(".swap-options button").first()).toBeVisible();
    await page.screenshot({ path: "test-results/review-swap-desktop.png" });
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Cook From My Pantry", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Meal to discover", exact: true })
      .selectOption("Breakfast");
    const discovery = page.locator(".discovery-recipe").first();
    await expect(discovery).toContainText(/Pantry coverage: [1-9]\d*%/);
    const chosen = await discovery.locator("h3").innerText();
    await discovery.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/review-pantry-desktop.png" });
    await discovery
      .getByRole("button", { name: "Use for breakfast", exact: true })
      .click();
    await expect(page.locator(".plan-meal").first().locator("h3")).toHaveText(
      chosen,
    );
    await expect(
      page.getByRole("button", { name: "Save plan", exact: true }),
    ).toBeEnabled();
    // Discard this review-only draft and restore the original display preference.
    await page.goto("/preferences");
    await page
      .getByRole("button", { name: "Edit country & measurement", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Country", exact: true })
      .selectOption(before.profiles[0].country_code);
    await page
      .getByRole("combobox", { name: "Measurement system", exact: true })
      .selectOption(before.profiles[0].display_units_override || "");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "test-results/review-preferences-mobile.png",
    });
    await page
      .getByRole("button", { name: "Save country & measurement", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/budget");
    await page
      .getByRole("button", { name: "Log purchase", exact: true })
      .click();
    await expect(page.getByLabel("Item 1 source")).toHaveValue("shopping");
    await page.getByLabel("Item 1 source").selectOption("recent");
    await expect(
      page.getByLabel("Match item 1").locator("option"),
    ).not.toHaveCount(1);
    await page.screenshot({
      path: "test-results/review-manual-receipt-mobile.png",
    });
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.goto("/groceries");
    await page.locator(".session-history summary").click();
    await page.locator(".session-history").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/review-receipt-mobile.png" });
    await expect(page.locator(".session-history")).toContainText("Finished");
    await page
      .locator(".session-history")
      .getByRole("button", { name: "Correct price", exact: true })
      .click();
    await page.screenshot({
      path: "test-results/review-correction-mobile.png",
    });
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    expect(errors).toEqual([]);
  } finally {
    // A failed review must not change the unit/currency assumptions of later scenarios.
    await page.goto("/preferences");
    await page
      .getByRole("button", { name: "Edit country & measurement", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Country", exact: true })
      .selectOption(before.profiles[0].country_code);
    await page
      .getByRole("combobox", { name: "Measurement system", exact: true })
      .selectOption(before.profiles[0].display_units_override || "");
    await page
      .getByRole("button", { name: "Save country & measurement", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});
