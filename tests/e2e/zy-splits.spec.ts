import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { localDate } from "@/lib/date";
process.loadEnvFile(".env.local");
const qa = JSON.parse(readFileSync(".env.qa-split", "utf8"));
test("save Best Split, shop stores independently, handle stale needs and isolate users", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  for (let i = 0; i < 8; i++) {
    if (i === 0) await page.getByLabel("First name").fill("Split QA");
    if (i === 5) {
      await page.getByLabel("ZIP code").fill("90210");
      await page.getByRole("button", { name: "Costco", exact: true }).click();
      await page.getByRole("button", { name: "Walmart", exact: true }).click();
    }
    await page
      .getByRole("button", { name: "Save & continue", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Start my daily rhythm", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard/);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect((await client.auth.signInWithPassword(qa)).error).toBeNull();
  const snapshot = async () =>
    await (await page.request.get("/api/export")).json();
  const initial = await snapshot(),
    today = localDate(initial.profiles[0].timezone);
  const foods = (
    await client.from("foods").select("id,name").in("name", ["Eggs", "Rice"])
  ).data!;
  const products = (
    await client
      .from("retail_products")
      .select("*")
      .eq("is_active", true)
      .in(
        "food_id",
        foods.map((f) => f.id),
      )
  ).data!;
  const locations = (
    await client
      .from("store_locations")
      .select("*,store:stores!inner(name,slug)")
      .eq("currency", "USD")
  ).data!;
  const eggs = foods.find((f) => f.name === "Eggs")!,
    rice = foods.find((f) => f.name === "Rice")!;
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const r = await client.rpc(name, args);
    expect(r.error, `${name}: ${r.error?.message}`).toBeNull();
    return r.data;
  };
  expect(
    (
      await client.from("daily_meal_logs").insert({
        user_id: qa.id,
        local_date: today,
        slot: "Lunch",
        name: "Split grocery fixture",
        calories: 100,
        protein: 10,
        carbs: 10,
        fat: 2,
        fiber: 1,
        ingredients: [
          { food_id: eggs.id, name: eggs.name, quantity_g: 400 },
          { food_id: rice.id, name: rice.name, quantity_g: 500 },
        ],
      })
    ).error,
  ).toBeNull();
  // Real transactions on this disposable account supply private known-location price observations.
  // Shared retailer fixtures are never changed to force a split.
  for (const [food, slug] of [
    [eggs, "costco"],
    [rice, "walmart"],
  ] as const) {
    const loc = locations.find(
      (l) => (l.store as unknown as { slug: string }).slug === slug,
    )!;
    const product = products.find((p) => p.food_id === food.id)!;
    const item = (
      await client
        .from("shopping_list_items")
        .select("*")
        .eq("food_id", food.id)
        .eq("fulfillment", "needed")
    ).data![0];
    const session = crypto.randomUUID();
    await rpc("start_shopping_session", {
      p_id: session,
      p_store: loc.store_id,
      p_location: loc.id,
      p_name: slug,
      p_currency: "USD",
      p_date: today,
    });
    await rpc("fulfill_shopping_item", {
      p_request: crypto.randomUUID(),
      p_session: session,
      p_item: item.id,
      p_expected: item.updated_at,
      p_product: product.id,
      p_offer: null,
      p_quantity: 1,
      p_unit: "package",
      p_price: 1,
      p_price_source: "manual",
      p_expires: null,
    });
    await rpc("finish_shopping_session", { p_session: session });
  }
  expect(
    (
      await client
        .from("pantry_items")
        .update({ quantity_g: 0 })
        .eq("user_id", qa.id)
    ).error,
  ).toBeNull();
  await page.goto("/groceries");
  await page
    .getByRole("spinbutton", { name: "Extra store penalty (USD)" })
    .fill("0");
  await expect(
    page
      .locator(".optimizer-cart")
      .filter({ has: page.getByText("Best Split", { exact: true }) })
      .locator("summary"),
  ).toContainText("2 stores");
  const before = await snapshot();
  await page
    .getByRole("button", { name: "Use This Plan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Applied shopping plan", exact: true }),
  ).toBeVisible();
  const applied = await snapshot();
  expect(applied.split_plans).toHaveLength(1);
  expect(applied.split_assignments).toHaveLength(2);
  expect(applied.pantry_items).toEqual(before.pantry_items);
  expect(applied.purchases).toEqual(before.purchases);
  expect(applied.shopping_list_items).toEqual(before.shopping_list_items);
  const plan = applied.split_plans[0];
  const lines = applied.split_assignments.map(
    (a: {
      item_id: string;
      product_id: string;
      location_id: string;
      package_count: number;
      expected_unit_price: number;
      price_source: string;
      price_reference_id: string;
    }) => ({
      item: a.item_id,
      expected: before.shopping_list_items.find(
        (i: { id: string }) => i.id === a.item_id,
      ).updated_at,
      product: a.product_id,
      location: a.location_id,
      count: Number(a.package_count),
      price: Number(a.expected_unit_price),
      source: a.price_source,
      reference: a.price_reference_id,
    }),
  );
  const repeats = await Promise.all(
    Array.from({ length: 3 }, () =>
      client.rpc("apply_split_plan", {
        p_lines: lines,
        p_currency: "USD",
        p_max_stores: 2,
        p_penalty: 0,
        p_baseline: plan.baseline_total,
      }),
    ),
  );
  for (const r of repeats) {
    expect(r.error).toBeNull();
    expect(r.data).toBe(plan.id);
  }
  expect((await snapshot()).split_plans).toHaveLength(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Applied shopping plan", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Compare this shopping basket",
      exact: true,
    }),
  ).toHaveCount(0);
  const group = (name: string) =>
    page
      .locator(".split-store")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await group("Costco")
    .getByRole("button", { name: "Shop Costco", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Shopping at Costco", exact: true }),
  ).toBeVisible();
  await group("Costco")
    .getByRole("button", { name: "Purchase", exact: true })
    .click();
  await expect(page.getByLabel("Purchased quantity")).toHaveValue("1");
  await page.getByLabel("Purchase unit price").fill("2.25");
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Partially shopped shopping plan",
      exact: true,
    }),
  ).toBeVisible();
  await expect(group("Costco")).toContainText("Purchased");
  await expect(group("Walmart")).toContainText("To buy");
  const partial = await snapshot();
  expect(partial.purchase_items.length).toBe(before.purchase_items.length + 1);
  expect(
    Number(
      partial.pantry_items.find(
        (p: { food_id: string }) => p.food_id === eggs.id,
      ).quantity_g,
    ),
  ).toBe(600);
  expect(
    Number(
      partial.pantry_items.find(
        (p: { food_id: string }) => p.food_id === rice.id,
      ).quantity_g,
    ),
  ).toBe(0);
  expect(
    partial.shopping_list_items.filter(
      (i: { food_id: string; fulfillment: string }) =>
        i.food_id === eggs.id && i.fulfillment === "needed",
    ),
  ).toHaveLength(0);
  expect(
    partial.shopping_list_items.filter(
      (i: { food_id: string; fulfillment: string }) =>
        i.food_id === rice.id && i.fulfillment === "needed",
    ),
  ).toHaveLength(1);
  await page
    .getByRole("button", { name: "Finish shopping", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start shopping", exact: true }),
  ).toBeVisible();
  await page.goto("/budget");
  await expect(page.getByTestId("budget-spent")).toHaveText("USD 4.25");
  await page.goto("/groceries");
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await group("Walmart")
    .getByRole("button", { name: "Shop Walmart", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Shopping at Walmart", exact: true }),
  ).toBeVisible();
  await group("Walmart")
    .getByRole("button", { name: "Purchase", exact: true })
    .click();
  await page.getByLabel("Purchase unit price").fill("3.50");
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Completed shopping plan", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Finish shopping", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start shopping", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".split-plan-panel")
    .screenshot({ path: "test-results/split-completed-mobile.png" });
  const completed = await snapshot();
  expect(completed.split_plans[0].status).toBe("completed");
  expect(
    completed.split_assignments.every(
      (a: { state: string }) => a.state === "purchased",
    ),
  ).toBe(true);
  expect(Number(completed.split_plans[0].expected_total)).toBe(2);
  await page.goto("/budget");
  await expect(page.getByTestId("budget-spent")).toHaveText("USD 7.75");
  // A newly depleted need is a new recommendation, not a reopened historical assignment.
  expect(
    (
      await client
        .from("pantry_items")
        .update({ quantity_g: 0 })
        .eq("user_id", qa.id)
    ).error,
  ).toBeNull();
  await page.goto("/groceries");
  await page
    .getByRole("button", { name: "Compare a new plan", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Extra store penalty (USD)" })
    .fill("0");
  await page
    .getByRole("button", { name: "Use This Plan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Applied shopping plan", exact: true }),
  ).toBeVisible();
  expect(
    (
      await client
        .from("pantry_items")
        .update({ quantity_g: 100 })
        .eq("food_id", eggs.id)
    ).error,
  ).toBeNull();
  await page.reload();
  await expect(group("Costco")).toContainText("Quantity changed");
  await expect(
    group("Costco").getByRole("button", { name: "Purchase", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .locator(".split-plan-panel")
    .screenshot({ path: "test-results/split-stale-desktop.png" });
  const b = JSON.parse(readFileSync(".env.qa-second", "utf8"));
  expect((await client.auth.signInWithPassword(b)).error).toBeNull();
  expect((await client.from("split_plans").select("*")).data).toEqual([]);
  expect((await client.from("split_assignments").select("*")).data).toEqual([]);
  expect(
    (await client.rpc("abandon_split_plan", { p_plan: plan.id })).error,
  ).not.toBeNull();
  expect(errors).toEqual([]);
});
