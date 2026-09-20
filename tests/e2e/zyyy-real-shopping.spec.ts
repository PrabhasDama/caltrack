import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
process.loadEnvFile(".env.local");
const qa = JSON.parse(readFileSync(".env.qa-split", "utf8"));

test("real location checkout, corrected observations, retries and mixed-price basket", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect((await client.auth.signInWithPassword(qa)).error).toBeNull();
  const location = (
    await client
      .from("store_locations")
      .select("id,store_id,name,provider_location_id")
      .eq("provider_location_id", "70300186")
      .single()
  ).data!;
  expect(location.name).toBe("Ralphs - Traffic Circle");
  const product = (
    await client
      .from("retail_products")
      .select("id")
      .eq("provider", "kroger:certification")
      .eq("provider_product_id", "0001111090406")
      .single()
  ).data!;
  const snapshot = async () => (await page.request.get("/api/export")).json();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/groceries");
  const before = await snapshot();
  const need = before.shopping_list_items.find(
    (i: { name: string; fulfillment: string }) =>
      i.name === "Eggs" && i.fulfillment === "needed",
  );
  expect(need).toBeTruthy();
  const row = page
    .locator(".shopping-row")
    .filter({ has: page.getByRole("heading", { name: "Eggs", exact: true }) });
  await page
    .getByRole("button", { name: "Start shopping", exact: true })
    .click();
  await page.getByLabel("Shopping store").selectOption(location.store_id);
  await page.getByLabel("Shopping location").selectOption(location.id);
  await page
    .getByRole("button", { name: "Start this shopping trip", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await row.getByRole("button", { name: "Purchase", exact: true }).click();
  await page.getByLabel("Purchased product").selectOption(product.id);
  await expect(page.getByLabel("Purchase unit price")).toHaveValue("");
  await expect(page.getByRole("dialog")).toContainText(
    "Price needs confirmation",
  );
  await expect(page.getByRole("dialog")).not.toContainText("USD 0.00");
  await page.getByLabel("Purchase unit price").fill("2.49");
  await page.screenshot({ path: "test-results/real-checkout-mobile.png" });
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row).toHaveCount(0);
  const bought = await snapshot();
  const event = bought.shopping_fulfillments.find(
    (e: { item_id: string; state: string }) =>
      e.item_id === need.id && e.state === "purchased",
  );
  const line = bought.purchase_items.find(
    (p: { id: string }) => p.id === event.purchase_item_id,
  );
  const receipt = bought.purchases.find(
    (p: { id: string }) => p.id === line.purchase_id,
  );
  expect(Number(line.unit_price)).toBe(2.49);
  expect(Number(receipt.total)).toBe(2.49);
  expect(receipt.store_location_id).toBe(location.id);
  expect(
    bought.receipt_price_observations.filter(
      (o: { purchase_item_id: string }) => o.purchase_item_id === line.id,
    ),
  ).toHaveLength(1);
  const stock = (d: typeof bought) =>
    Number(
      d.pantry_items.find(
        (p: { food_id: string }) => p.food_id === need.food_id,
      )?.quantity_g || 0,
    );
  expect(stock(bought)).toBe(stock(before) + 600);
  for (const r of await Promise.all(
    Array.from({ length: 3 }, () =>
      client.rpc("fulfill_shopping_item", {
        p_request: event.id,
        p_session: event.session_id,
        p_item: need.id,
        p_expected: need.updated_at,
        p_product: product.id,
        p_offer: null,
        p_quantity: 1,
        p_unit: "package",
        p_price: 2.49,
        p_price_source: "manual",
        p_expires: null,
      }),
    ),
  ))
    expect(r.error).toBeNull();
  const retried = await snapshot();
  for (const key of [
    "purchases",
    "purchase_items",
    "receipt_price_observations",
    "pantry_items",
  ])
    expect(retried[key]).toEqual(bought[key]);
  await page
    .getByRole("button", { name: "Finish shopping", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start shopping", exact: true }),
  ).toBeVisible();
  await page.locator(".session-history summary").click();
  const history = page
    .locator(".session-history article")
    .filter({ hasText: "Ralphs" });
  await history
    .getByRole("button", { name: "Correct price", exact: true })
    .click();
  await page.getByLabel("Price per package", { exact: true }).fill("2.79");
  await page
    .getByRole("button", { name: "Save corrected price", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(history).toContainText("USD 2.79");
  const corrected = await snapshot();
  expect(
    Number(
      corrected.purchase_items.find((p: { id: string }) => p.id === line.id)
        .unit_price,
    ),
  ).toBe(2.79);
  expect(corrected.receipt_price_observations).toEqual(
    bought.receipt_price_observations,
  );
  expect(stock(corrected)).toBe(stock(bought));
  await page.goto("/budget");
  await expect(page.getByTestId("budget-spent")).toHaveText("USD 10.54");
  await page.reload();
  await expect(page.getByTestId("budget-spent")).toHaveText("USD 10.54");
  await page.goto("/pantry");
  const eggPantryCard = page
    .locator(".pantry-card")
    .filter({ has: page.getByRole("heading", { name: "Eggs", exact: true }) });
  await eggPantryCard
    .getByRole("button", { name: "Mark depleted", exact: true })
    .click();
  // Depletion is a server action; wait for the saved result before navigating.
  await expect(eggPantryCard).toContainText("Depleted");
  expect(stock(await snapshot())).toBe(0);
  await page.goto("/groceries");
  await expect(row).toHaveCount(1);
  const replenished = await snapshot();
  expect(
    replenished.shopping_list_items.filter(
      (i: { food_id: string; fulfillment: string }) =>
        i.food_id === need.food_id && i.fulfillment === "needed",
    ),
  ).toHaveLength(1);
  await expect(row).toContainText("USD 2.79");
  await expect(row).toContainText("Last confirmed price");
  await page
    .getByRole("button", { name: "Compare a new plan", exact: true })
    .click();
  const split = page
    .locator(".optimizer-cart")
    .filter({ has: page.getByText("Best Split", { exact: true }) });
  await split.locator("summary").click();
  await expect(split).toContainText("USD 2.79");
  await expect(split).toContainText("Unpriced: Rice");
  await expect(split).toContainText("Full cost and savings are unavailable");
  await expect(
    page.getByRole("button", { name: "Use This Plan", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/Estimated basket savings:/)).toHaveCount(0);
  await page.screenshot({ path: "test-results/mixed-basket-mobile.png" });
  expect(errors).toEqual([]);
});
