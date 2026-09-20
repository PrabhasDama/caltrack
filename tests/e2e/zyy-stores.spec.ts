import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
const qa = JSON.parse(readFileSync(".env.qa-split", "utf8"));
test("real Kroger prices and missing prices, persisted locations, mobile fallback and safe comparison", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/stores");
  await page.getByLabel("ZIP / postal code").fill("90815");
  await page.getByLabel("Search radius (miles)").fill("10");
  await page
    .getByRole("button", { name: "Save store settings", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("saved");
  await page
    .getByRole("button", { name: "Find nearby stores", exact: true })
    .click();
  const store = page.locator(".store-result").filter({
    has: page.getByRole("button", {
      name: "Ralphs - Traffic Circle",
      exact: true,
    }),
  });
  await expect(store).toBeVisible({ timeout: 45000 });
  await store
    .getByRole("button", { name: "Prefer this location", exact: true })
    .click();
  await expect(store).toContainText("Preferred location");
  await page.reload();
  await expect(store).toContainText("Preferred location");
  await store
    .getByRole("button", { name: "Ralphs - Traffic Circle", exact: true })
    .click();
  await expect(store).toContainText("1930 N Lakewood Blvd");
  await expect(
    page.getByRole("heading", { name: "Products at Ralphs - Traffic Circle" }),
  ).toBeVisible();
  await page.getByLabel("Search store products").fill("milk");
  // Chrome can discard streamed action bodies during revalidation. Capture the
  // real server response before forwarding it unchanged to the browser.
  let resolveBody!: (body: string) => void;
  let rejectBody!: (error: unknown) => void;
  const searchResponse = new Promise<string>((resolve, reject) => {
    resolveBody = resolve;
    rejectBody = reject;
  });
  await page.route("**/stores", async (route) => {
    if (route.request().method() !== "POST" || !route.request().postData()?.includes('"term":"milk"')) return route.continue();
    try {
      const response = await route.fetch();
      resolveBody(await response.text());
      await route.fulfill({ response });
    } catch (error) { rejectBody(error); await route.abort(); }
  });
  await page
    .getByRole("button", { name: "Search products", exact: true })
    .click();
  const responseBody = await searchResponse;
  await page.unroute("**/stores");
  for (const key of ["KROGER_CLIENT_SECRET", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const secret = process.env[key];
    if (secret)
      expect(
        responseBody.includes(secret),
        `${key} must not reach browser`,
      ).toBe(false);
  }
  expect(responseBody.includes('"access_token"')).toBe(false);
  const payload = responseBody
    .split("\n")
    .filter((line) => /^[\da-f]+:\{\"products\":/.test(line))
    .map((line) => JSON.parse(line.slice(line.indexOf(":") + 1)))[0];
  const returned = payload.products.find(
    (p: { providerProductId: string }) =>
      p.providerProductId === "0001111001798",
  );
  expect(returned.effectivePrice).toBe(3.29);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect((await client.auth.signInWithPassword(qa)).error).toBeNull();
  const location = await client
    .from("store_locations")
    .select("id,name,store:stores(name)")
    .eq("provider_location_id", "70300186")
    .single();
  expect(location.error).toBeNull();
  expect(location.data?.name).toBe("Ralphs - Traffic Circle");
  expect(location.data?.store).toMatchObject({ name: "RALPHS" });
  const persisted = await client
    .from("store_offers")
    .select(
      "price,regular_price,promo_price,environment,price_status,availability",
    )
    .eq("product_id", returned.id)
    .eq("location_id", location.data!.id)
    .single();
  expect(persisted.error).toBeNull();
  expect(Number(persisted.data?.price)).toBe(returned.effectivePrice);
  expect(Number(persisted.data?.regular_price)).toBe(returned.regularPrice);
  expect(persisted.data?.environment).toBe("certification");
  expect(persisted.data?.availability).toBe(returned.availability);
  const cheese = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", {
        name: "Kroger® Whole Milk Shredded Mozzarella Cheese",
        exact: true,
      }),
    })
    .first();
  await expect(cheese).toBeVisible({ timeout: 45000 });
  await expect(
    page.getByRole("heading", { name: returned.description, exact: true }),
  ).toHaveCount(1);
  await expect(cheese).toContainText("USD 3.29");
  await expect(cheese).toContainText("8 oz");
  await expect(cheese).toContainText(
    `Availability: ${returned.availability.replaceAll("_", " ")}`,
  );
  await expect(cheese).toContainText(
    "Certification price · needs confirmation",
  );
  await expect(cheese).not.toContainText(/Live price|Current price/);
  await expect(cheese).toContainText("0001111001798");
  await expect(cheese.locator(".price-display small")).toContainText("UTC");
  const observedLabel = await cheese
    .locator(".price-display small")
    .innerText();
  await cheese
    .getByRole("button", { name: "Full product details", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "1 product packages returned",
  );
  await expect(cheese).toContainText("USD 3.29");
  // A repeat search uses the provider cache; keep the original observation time.
  await page
    .getByRole("button", { name: "Search products", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "12 product packages returned",
  );
  await expect(cheese.locator(".price-display small")).toHaveText(
    observedLabel,
  );
  await expect(cheese).toContainText("USD 3.29");
  await page.getByLabel("Search store products").fill("eggs");
  await page
    .getByRole("button", { name: "Search products", exact: true })
    .click();
  const egg = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", {
        name: "Kroger® Grade AA Cage Free Large White Eggs",
        exact: true,
      }),
    })
    .first();
  await expect(egg).toBeVisible({ timeout: 45000 });
  await expect(egg).toContainText("Price unavailable");
  await expect(egg).not.toContainText("USD 0.00");
  await expect(egg).not.toContainText(/Live price|Current price/);
  await expect(egg).toContainText("12 ct");
  await egg
    .getByRole("button", { name: "Full product details", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "1 product packages returned",
  );
  await expect(egg).toContainText("Price unavailable");
  await egg
    .getByText("Review food match for my groceries", { exact: true })
    .click();
  await egg.getByLabel("Matching food").selectOption({ label: "Eggs" });
  await egg.getByLabel("Whole package weight (g)").fill("600");
  await egg
    .getByRole("button", { name: "Confirm food and package", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Food match saved");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Map and list", exact: true }).click();
  await expect(
    page.getByText("Map display is not configured.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          _ok: unknown,
          fail: (e: { code: number }) => void,
        ) => fail({ code: 1 }),
      },
    }),
  );
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "ZIP search still works",
  );
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.screenshot({ path: "test-results/stores-mobile.png" });
  await page.goto("/groceries");
  await page
    .getByRole("button", { name: "Compare a new plan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Use This Plan", exact: true }),
  ).toBeDisabled();
  await page.locator("summary").filter({ hasText: "Best Split" }).click();
  await expect(
    page.locator("details[open]").getByText(/Unpriced:/),
  ).toBeVisible();
  const comparison = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "Compare this shopping basket" }),
  });
  await expect(comparison).not.toContainText("USD 3.29");
  expect(errors).toEqual([]);
});
