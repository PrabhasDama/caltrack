import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const qa = JSON.parse(readFileSync(".env.qa", "utf8"));
test("live replenishment, receipt reversal, optimizer and warm navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const snapshot = async () =>
    await (await page.request.get("/api/export")).json();
  const data = await snapshot();
  const ingredients = data.daily_meal_logs
    .filter((m: { status: string }) => m.status === "planned")
    .flatMap(
      (m: { ingredients: { food_id: string; name: string }[] }) =>
        m.ingredients,
    );
  const stock = data.pantry_items.find(
    (p: { quantity_g: number; food_id: string }) =>
      Number(p.quantity_g) > 0 &&
      ingredients.some((i: { food_id: string }) => i.food_id === p.food_id),
  );
  expect(stock).toBeTruthy();
  const ingredient = ingredients.find(
    (i: { food_id: string }) => i.food_id === stock.food_id,
  );
  const active = (d: typeof data) =>
    d.shopping_list_items.filter(
      (i: { food_id: string; fulfillment: string }) =>
        i.food_id === stock.food_id && i.fulfillment === "needed",
    );
  const groceryRow = () =>
    page
      .locator(".shopping-row")
      .filter({
        has: page.getByRole("heading", { name: ingredient.name, exact: true }),
      });
  await page.goto("/pantry");
  const card = page
    .locator(".pantry-card")
    .filter({
      has: page.getByRole("heading", { name: ingredient.name, exact: true }),
    });
  await card
    .getByRole("button", { name: "Mark depleted", exact: true })
    .click();
  await expect(card).toContainText("Depleted");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "Groceries", exact: true }).click();
  await expect(groceryRow()).toHaveCount(1);
  const depleted = await snapshot();
  expect(active(depleted)).toHaveLength(1);
  const need = active(depleted)[0];
  expect(Number(need.amount)).toBeGreaterThan(0);
  expect(Number(need.pantry_g)).toBe(0);
  // A reload/reconciliation keeps one requirement and its identity.
  await page.reload();
  expect(active(await snapshot()).map((i: { id: string }) => i.id)).toEqual([
    need.id,
  ]);
  await page
    .getByRole("button", { name: "Start shopping", exact: true })
    .click();
  await page.getByLabel("Shopping store").selectOption("");
  await page
    .getByLabel("Store name", { exact: true })
    .fill("QA Phase 9 lifecycle");
  await page
    .getByRole("button", { name: "Start this shopping trip", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const buy = async () => {
    await groceryRow()
      .getByRole("button", { name: "Purchase", exact: true })
      .click();
    expect(await page.getByLabel("Purchased product").inputValue()).not.toBe(
      "",
    );
    await page.getByLabel("Purchase unit price").fill("3.25");
    const count = Number(
      await page.getByLabel("Purchased quantity").inputValue(),
    );
    expect(Number.isInteger(count)).toBe(true);
    await page
      .getByRole("button", { name: "Confirm purchase", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(groceryRow()).toHaveCount(0);
    return count;
  };
  const count = await buy();
  const bought = await snapshot();
  const event = bought.shopping_fulfillments.find(
    (e: { item_id: string; state: string }) =>
      e.item_id === need.id && e.state === "purchased",
  );
  expect(event).toBeTruthy();
  expect(Number(event.added_g)).toBeGreaterThanOrEqual(Number(need.amount));
  expect(
    Number(
      bought.pantry_items.find(
        (p: { food_id: string }) => p.food_id === stock.food_id,
      ).quantity_g,
    ),
  ).toBe(Number(event.added_g));
  const session = bought.shopping_sessions.find(
    (s: { id: string }) => s.id === event.session_id,
  );
  expect(
    Number(
      bought.purchases.find((p: { id: string }) => p.id === session.purchase_id)
        .total,
    ),
  ).toBe(count * 3.25);
  expect(bought.purchase_items.length).toBe(depleted.purchase_items.length + 1);
  // Reverse from Budget on mobile; receipt history survives and stock/need reconcile.
  await page.goto("/budget");
  await page.setViewportSize({ width: 390, height: 844 });
  const receipt = () =>
    page
      .locator(".purchase-card")
      .filter({
        has: page.getByRole("heading", {
          name: "QA Phase 9 lifecycle",
          exact: true,
        }),
      });
  await receipt()
    .getByRole("button", { name: "Shopping receipt · view and correct" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Total:");
  await expect(page).toHaveURL(/\/budget/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/receipt-modal-mobile.png" });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Undo purchase", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reverse purchase", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByRole("dialog")).toContainText("reversed");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page).toHaveURL(/\/budget/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/groceries");
  await expect(groceryRow()).toHaveCount(1);
  expect(
    Number(
      (await snapshot()).pantry_items.find(
        (p: { food_id: string }) => p.food_id === stock.food_id,
      ).quantity_g,
    ),
  ).toBe(0);
  await buy();
  await page
    .getByRole("button", { name: "Finish shopping", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start shopping", exact: true }),
  ).toBeVisible();
  const restocked = await snapshot();
  const grams = Number(
    restocked.pantry_items.find(
      (p: { food_id: string }) => p.food_id === stock.food_id,
    ).quantity_g,
  );
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Add a meal", exact: true }).click();
  await page
    .getByLabel("Meal name", { exact: true })
    .fill("QA extra pantry meal");
  await page.getByLabel("Meal slot", { exact: true }).selectOption("Snack");
  for (const name of [
    "Calories (kcal)",
    "Protein (g)",
    "Carbs (g)",
    "Fat (g)",
    "Fiber (g)",
  ])
    await page.getByLabel(name, { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Add ingredient", exact: true })
    .click();
  await page
    .getByLabel("Ingredient 1", { exact: true })
    .selectOption(stock.food_id);
  await page.getByLabel("Grams for ingredient 1").fill(String(grams));
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add meal", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const addedMeal = page
    .locator(".meal-card")
    .filter({
      has: page.getByRole("heading", {
        name: "QA extra pantry meal",
        exact: true,
      }),
    });
  await addedMeal
    .getByRole("button", { name: "Mark as eaten", exact: true })
    .click();
  await expect(
    addedMeal.getByRole("button", { name: "Eaten · undo", exact: true }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Groceries", exact: true }).click();
  await expect(groceryRow()).toHaveCount(1);
  const consumed = await snapshot();
  expect(
    Number(
      consumed.pantry_items.find(
        (p: { food_id: string }) => p.food_id === stock.food_id,
      ).quantity_g,
    ),
  ).toBe(0);
  expect(active(consumed)).toHaveLength(1);
  expect(consumed.purchase_items).toEqual(restocked.purchase_items);
  await groceryRow()
    .getByRole("button", { name: "Already have it", exact: true })
    .click();
  await expect(groceryRow()).toHaveCount(0);
  const have = await snapshot();
  expect(have.purchases).toEqual(consumed.purchases);
  expect(have.pantry_items).toEqual(consumed.pantry_items);
  await page.reload();
  await expect(groceryRow()).toHaveCount(0);
  // Measure safe warm returns for all requested pairs; no optimizer generation on navigation.
  for (const [target, other, label] of [
    ["Groceries", "Pantry", "Compare this shopping basket"],
    ["Plan", "Today", "Optimize for"],
    ["Budget", "Groceries", "Log purchase"],
  ]) {
    await nav.getByRole("link", { name: target, exact: true }).click();
    if (target === "Plan") await expect(page.getByLabel(label)).toBeVisible();
    else
      await expect(
        page.getByText(label, { exact: true }).first(),
      ).toBeVisible();
    await nav.getByRole("link", { name: other, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    let requests = 0;
    const path =
      target === "Groceries"
        ? "/groceries"
        : target === "Plan"
          ? "/plan"
          : "/budget";
    const listen = (r: import("@playwright/test").Request) => {
      if (new URL(r.url()).pathname === path && r.headers().rsc) requests++;
    };
    page.on("request", listen);
    const start = Date.now();
    await nav.getByRole("link", { name: target, exact: true }).click();
    if (target === "Plan") await expect(page.getByLabel(label)).toBeVisible();
    else
      await expect(
        page.getByText(label, { exact: true }).first(),
      ).toBeVisible();
    page.off("request", listen);
    console.log(
      JSON.stringify({
        route: path,
        repeatContentMs: Date.now() - start,
        rscRequests: requests,
      }),
    );
    expect(requests).toBe(0);
  }
  await page.goto("/plan");
  await page.getByLabel("Optimize for").selectOption("Pantry First");
  await expect(
    page.getByText(
      "Demo pricing · simulated estimates, not current retailer prices.",
      { exact: false },
    ),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/optimizer-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
