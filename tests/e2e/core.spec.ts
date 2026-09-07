import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
process.loadEnvFile(".env.local");
const qa = JSON.parse(readFileSync(".env.qa", "utf8"));
test("onboarding, daily tracking, mobile layout, and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address").fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("First name").fill("Morgan");
  await page.getByRole("button", { name: "Save & continue" }).click();
  await expect(
    page.getByRole("heading", { name: "What are you working toward?" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What are you working toward?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save & continue" }).click();
  await page.getByRole("button", { name: "Save & continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Fuel your kind of progress." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save & continue" }).click();
  await page.getByRole("button", { name: "Save & continue" }).click();
  await page.getByLabel("ZIP code").fill("90210");
  await page.getByRole("button", { name: "Costco", exact: true }).click();
  await page.getByRole("button", { name: "Save & continue" }).click();
  await page.getByRole("button", { name: "Tofu", exact: true }).click();
  await page.getByLabel("Ingredients to exclude").fill("Peanuts, shellfish");
  await page.getByRole("button", { name: "Save & continue" }).click();
  await page.getByRole("button", { name: "Save & continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Your foundation is ready." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start my daily rhythm" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /Morgan/ })).toBeVisible();
  await page.getByRole("button", { name: "+ 500 mL", exact: true }).click();
  await expect(
    page.getByRole("progressbar", { name: "Water", exact: true }),
  ).toHaveAttribute("aria-valuenow", "500");
  await page
    .getByRole("button", { name: "Ate breakfast", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ate breakfast", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Log my weight", exact: true })
    .click();
  await page.getByLabel("Weight (lb)", { exact: true }).fill("164.2");
  await page.getByRole("button", { name: "Save weight", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".weight-card .large-value")).toContainText(
    "164.2",
  );
  await page
    .getByRole("button", { name: "Log a workout", exact: true })
    .click();
  await page.getByLabel("Workout type").selectOption("Upper");
  await page.getByLabel("Duration in minutes (optional)").fill("45");
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Upper", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add a meal", exact: true }).click();
  await page.getByLabel("Meal name", { exact: true }).fill("Tofu rice bowl");
  await page.getByLabel("Meal slot", { exact: true }).selectOption("Lunch");
  await page.getByLabel("Calories (kcal)", { exact: true }).fill("550");
  await page.getByLabel("Protein (g)", { exact: true }).fill("35");
  await page.getByLabel("Carbs (g)", { exact: true }).fill("70");
  await page.getByLabel("Fat (g)", { exact: true }).fill("15");
  await page.getByLabel("Fiber (g)", { exact: true }).fill("9");
  await page
    .getByRole("button", { name: "Add ingredient", exact: true })
    .click();
  await page
    .getByLabel("Ingredient 1", { exact: true })
    .selectOption({ label: "Tofu" });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add meal", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mark as eaten", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Eaten · undo", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".calorie-total strong")).toHaveText("550");
  await page
    .getByRole("button", { name: "Add extra food", exact: true })
    .click();
  await page.getByLabel("Food name", { exact: true }).fill("Apple");
  await page.getByLabel("Calories (kcal)", { exact: true }).fill("95");
  await page.getByLabel("Fiber (g)", { exact: true }).fill("4");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add extra food", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".calorie-total strong")).toHaveText("645");
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.goto("/dashboard");
  await page.screenshot({
    path: "test-results/dashboard-dark-mobile.png",
    fullPage: true,
  });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address").fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator(".calorie-total strong")).toHaveText("645");
  await expect(
    page.getByRole("progressbar", { name: "Water", exact: true }),
  ).toHaveAttribute("aria-valuenow", "500");
  await expect(
    page.getByRole("button", { name: "Upper", exact: true }),
  ).toBeVisible();
  await page.goto("/profile");
  await expect(
    page.getByText("Peanuts, shellfish", { exact: true }),
  ).toBeVisible();
  await page.goto("/progress");
  await expect(
    page.getByRole("heading", { name: "Your weight history" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const response = await page.request.get("/api/export");
  expect(response.status()).toBe(200);
  const exported = await response.json();
  expect(exported.workouts).toHaveLength(1);
  expect(exported.daily_meal_logs).toHaveLength(1);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/preferences");
  const beforePreferences = await (
    await page.request.get("/api/export")
  ).json();
  await page
    .getByRole("button", { name: "Edit meals & cooking", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Cooking time", exact: true })
    .selectOption("20");
  await page
    .getByRole("button", { name: "Save meals & cooking", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("updated");
  const afterPreferences = await (await page.request.get("/api/export")).json();
  expect(afterPreferences.user_preferences[0].cooking_minutes).toBe(20);
  expect(afterPreferences.user_preferences[0].disliked_foods).toEqual(
    beforePreferences.user_preferences[0].disliked_foods,
  );
  expect(afterPreferences.macro_targets).toEqual(
    beforePreferences.macro_targets,
  );
  expect(afterPreferences.budgets).toEqual(beforePreferences.budgets);
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/preferences/);
  await page.screenshot({
    path: "test-results/preferences-desktop.png",
    fullPage: true,
  });
  await page.goto("/plan");
  await page
    .getByRole("button", { name: "Generate week", exact: true })
    .first()
    .click();
  await expect(page.locator(".plan-meal")).not.toHaveCount(0);
  await page
    .getByRole("button", { name: "Swap meal", exact: true })
    .first()
    .click();
  await page.locator(".swap-options button").first().click();
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save plan", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: "test-results/plan-desktop.png",
    fullPage: true,
  });
  const planned = await (await page.request.get("/api/export")).json();
  expect(planned.meal_plan_days).toHaveLength(7);
  const meal = planned.daily_meal_logs.find(
    (m: { template_id: string | null; local_date: string; slot: string }) =>
      m.template_id &&
      m.local_date ===
        planned.meal_plan_days
          .map((d: { local_date: string }) => d.local_date)
          .sort()[0] &&
      m.slot === "Breakfast",
  );
  expect(meal).toBeTruthy();
  const ingredient = meal.ingredients[0];
  await page.goto("/groceries");
  await page
    .getByRole("button", { name: "Update from meal plan", exact: true })
    .click();
  await expect(page.locator(".shopping-row")).not.toHaveCount(0);
  await expect(
    page.getByText("Demo pricing", { exact: true }).first(),
  ).toBeVisible();
  const beforeStock = await (await page.request.get("/api/export")).json();
  const beforeAmount = Number(
    beforeStock.shopping_list_items.find(
      (i: { food_id: string }) => i.food_id === ingredient.food_id,
    ).amount,
  );
  await page.goto("/pantry");
  await page
    .getByRole("button", { name: "Add ingredient", exact: true })
    .click();
  await page.getByLabel("Pantry ingredient").selectOption(ingredient.food_id);
  await page.getByLabel("Pantry unit").selectOption("g");
  await page.getByLabel("Quantity", { exact: true }).fill("2000");
  await page.getByLabel("Pantry unit").selectOption("kg");
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("2");
  await page.getByLabel("Pantry unit").selectOption("g");
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue(
    "2000",
  );
  await page
    .getByRole("button", { name: "Save pantry item", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    Number(
      (await (await page.request.get("/api/export")).json()).pantry_items[0]
        .quantity_g,
    ),
  ).toBe(2000);
  await page
    .getByRole("button", { name: "Edit quantity", exact: true })
    .click();
  await page.getByLabel("Quantity", { exact: true }).fill("2500");
  await page
    .getByRole("button", { name: "Save pantry item", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/groceries");
  await page
    .getByRole("button", { name: "Update from meal plan", exact: true })
    .click();
  await expect(page.getByRole("status")).toBeVisible();
  const stocked = await (await page.request.get("/api/export")).json();
  expect(
    Number(
      stocked.shopping_list_items.find(
        (i: { food_id: string; fulfillment: string }) =>
          i.food_id === ingredient.food_id && i.fulfillment === "needed",
      )?.amount || 0,
    ),
  ).toBeCloseTo(Math.max(0, beforeAmount - 2500), 2);
  await page.screenshot({
    path: "test-results/groceries-desktop.png",
    fullPage: true,
  });
  await page.goto("/dashboard");
  const mealCard = page
    .locator(".meal-card")
    .filter({
      has: page.getByRole("heading", { name: meal.name, exact: true }),
    })
    .first();
  await mealCard
    .getByRole("button", { name: "Mark as eaten", exact: true })
    .click();
  await expect(
    mealCard.getByRole("button", { name: "Eaten · undo", exact: true }),
  ).toBeVisible();
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect(
    (
      await client.auth.signInWithPassword({
        email: qa.email,
        password: qa.password,
      })
    ).error,
  ).toBeNull();
  const repeats = await Promise.all(
    Array.from({ length: 3 }, () =>
      client.rpc("set_meal_status", {
        p_meal_id: meal.id,
        p_status: "completed",
      }),
    ),
  );
  for (const r of repeats) expect(r.error).toBeNull();
  const consumed = await (await page.request.get("/api/export")).json();
  expect(Number(consumed.pantry_items[0].quantity_g)).toBeCloseTo(
    2500 - Number(ingredient.quantity_g),
    2,
  );
  expect(
    consumed.pantry_movements.filter(
      (m: { daily_meal_log_id: string; food_id: string }) =>
        m.daily_meal_log_id === meal.id && m.food_id === ingredient.food_id,
    ),
  ).toHaveLength(1);
  await page.goto("/budget");
  await page.getByRole("button", { name: "Log purchase", exact: true }).click();
  await expect(page.getByLabel("Item 1 source")).toHaveValue("shopping");
  await expect(
    page.getByLabel("Match item 1").locator("optgroup").first(),
  ).toHaveAttribute("label", "Demo retail packages");
  await page.getByLabel("Purchase store").selectOption({ label: "Costco" });
  // Stocked food correctly leaves the live list; historical receipts use recent meals.
  await page.getByLabel("Item 1 source").selectOption("recent");
  await page
    .getByLabel("Match item 1")
    .selectOption(`food:${ingredient.food_id}`);
  await page.getByLabel("Item 1 unit").selectOption("kg");
  await page.getByLabel("Item 1 price").fill("3.50");
  await page
    .getByRole("button", { name: "Save purchase", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("budget-spent")).toHaveText("USD 3.50");
  await page.locator(".purchase-card summary").click();
  await expect(page.locator(".receipt-items")).toContainText(
    "/ reference serving",
  );
  await page.screenshot({
    path: "test-results/budget-desktop.png",
    fullPage: true,
  });
  for (const route of ["plan", "groceries", "pantry", "budget"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${route}`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${route}-mobile.png`,
      fullPage: true,
    });
  }
  await page.goto("/settings");
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByLabel("Email address").fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/budget");
  await expect(page.getByTestId("budget-spent")).toHaveText("USD 3.50");
  const persisted = await (await page.request.get("/api/export")).json();
  expect(persisted.meal_plan_days).toHaveLength(7);
  expect(persisted.purchases).toHaveLength(1);
  expect(persisted.pantry_items[0].quantity_g).toBe(
    consumed.pantry_items[0].quantity_g,
  );
  expect(persisted.shopping_list_items.length).toBeGreaterThan(0);
  // Phase 6.5: pantry discovery, completed-meal state, and the atomic shopping loop.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/plan");
  await expect(
    page.getByText("Meal already completed.", { exact: false }),
  ).toBeVisible();
  await expect(
    page
      .locator(".plan-meal")
      .filter({ hasText: "Meal already completed." })
      .getByRole("button", { name: "Swap meal" }),
  ).toHaveCount(0);
  await page.locator(".plan-week button").nth(1).click();
  const previousNames = await page.locator(".plan-meal h3").allTextContents();
  await page
    .getByRole("button", { name: "Regenerate day", exact: true })
    .click();
  await expect(page.locator(".plan-meal h3")).not.toHaveText(previousNames);
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save plan", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Cook From My Pantry", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cook From My Pantry", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".discovery-recipe")).not.toHaveCount(0);
  await page
    .getByRole("button", { name: "Use Expiring Ingredients", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/pantry-discovery-desktop.png",
    fullPage: true,
  });
  await page.goto("/groceries");
  await page
    .getByRole("button", { name: "Update from meal plan", exact: true })
    .click();
  await expect(page.getByRole("status")).toBeVisible();
  const requirements = await (await page.request.get("/api/export")).json();
  const need = requirements.shopping_list_items.find(
    (i: { amount: number; food_id: string | null }) =>
      i.food_id && Number(i.amount) > 0 && i.food_id !== ingredient.food_id,
  );
  expect(need).toBeTruthy();
  await page
    .getByRole("button", { name: "Start shopping", exact: true })
    .click();
  await page.getByLabel("Shopping store").selectOption({ label: "Walmart" });
  await page.getByLabel("Shopping location").selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "Start this shopping trip", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Shopping at Walmart" }),
  ).toBeVisible();
  const row = page.locator(".shopping-row").filter({
    has: page.getByRole("heading", { name: need.name, exact: true }),
  });
  await row.getByRole("button", { name: "Purchase", exact: true }).click();
  await page.getByLabel("Purchase unit price", { exact: true }).fill("4.00");
  const packageCount = Number(
    await page.getByLabel("Purchased quantity", { exact: true }).inputValue(),
  );
  expect(Number.isInteger(packageCount)).toBe(true);
  expect(
    await page
      .getByLabel("Purchased quantity", { exact: true })
      .evaluate((input: HTMLInputElement) => input.validity.valid),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row).toHaveCount(0);
  const bought = await (await page.request.get("/api/export")).json();
  const event = bought.shopping_fulfillments.find(
    (e: { item_id: string; state: string }) =>
      e.item_id === need.id && e.state === "purchased",
  );
  expect(event).toBeTruthy();
  const pantryBefore = Number(
    requirements.pantry_items.find(
      (p: { food_id: string }) => p.food_id === need.food_id,
    )?.quantity_g || 0,
  );
  expect(
    Number(
      bought.pantry_items.find(
        (p: { food_id: string }) => p.food_id === need.food_id,
      ).quantity_g,
    ),
  ).toBeCloseTo(pantryBefore + Number(event.added_g), 2);
  const cart = bought.shopping_sessions.find(
    (s: { id: string }) => s.id === event.session_id,
  );
  const purchase = bought.purchases.find(
    (p: { id: string }) => p.id === cart.purchase_id,
  );
  expect(Number(purchase.total)).toBe(packageCount * 4);
  const purchaseLine = bought.purchase_items.find(
    (p: { id: string }) => p.id === event.purchase_item_id,
  );
  const again = await Promise.all(
    Array.from({ length: 3 }, () =>
      client.rpc("fulfill_shopping_item", {
        p_request: event.id,
        p_session: cart.id,
        p_item: need.id,
        p_expected: need.updated_at,
        p_product: purchaseLine.retail_product_id,
        p_offer: null,
        p_quantity: purchaseLine.quantity,
        p_unit: purchaseLine.unit,
        p_price: 4,
        p_price_source: "manual",
        p_expires: null,
      }),
    ),
  );
  for (const r of again) expect(r.error).toBeNull();
  const repeated = await (await page.request.get("/api/export")).json();
  expect(repeated.shopping_fulfillments).toHaveLength(1);
  expect(repeated.pantry_items).toEqual(bought.pantry_items);
  const have = requirements.shopping_list_items.find(
    (i: { id: string; amount: number }) =>
      i.id !== need.id && Number(i.amount) > 0,
  );
  await page
    .locator(".shopping-row")
    .filter({
      has: page.getByRole("heading", { name: have.name, exact: true }),
    })
    .getByRole("button", { name: "Already have it", exact: true })
    .click();
  const already = await (await page.request.get("/api/export")).json();
  expect(already.purchase_items).toHaveLength(bought.purchase_items.length);
  expect(already.pantry_items).toEqual(bought.pantry_items);
  expect(
    already.shopping_list_items.find((i: { id: string }) => i.id === have.id)
      .fulfillment,
  ).toBe("already_have");
  await page.goto("/budget");
  await page
    .getByRole("button", { name: "Shopping receipt · view and correct" })
    .click();
  await expect(page).toHaveURL(/\/budget/);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Correct price", exact: true })
    .click();
  await page.getByLabel("Price per package", { exact: true }).fill("4.50");
  await page
    .getByRole("button", { name: "Save corrected price", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.goto("/groceries");
  await page
    .getByRole("button", { name: "Finish shopping", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start shopping", exact: true }),
  ).toBeVisible();
  await page.goto("/budget");
  await expect(page.getByTestId("budget-spent")).toHaveText(
    `USD ${(3.5 + packageCount * 4.5).toFixed(2)}`,
  );
  await expect(page.getByText("Within budget", { exact: false })).toBeVisible();
  await page.screenshot({
    path: "test-results/connected-budget-desktop.png",
    fullPage: true,
  });
  for (const route of [
    "preferences",
    "plan",
    "groceries",
    "pantry",
    "budget",
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${route}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/phase65-${route}-mobile.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
