import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const qa = JSON.parse(readFileSync(".env.qa", "utf8"));
test("receipt review commits once and prep rolls back a failed optimistic change", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const before = await (await page.request.get("/api/export")).json();
  const item = before.shopping_list_items.find(
    (i: {
      fulfillment: string;
      unit: string;
      food_id: string;
      amount: number;
    }) =>
      i.fulfillment === "needed" &&
      i.unit === "g" &&
      i.food_id &&
      Number(i.amount) > 0,
  );
  expect(item).toBeTruthy();
  await page.goto("/scan/receipt");
  await page.getByLabel("Choose image").setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByRole("button", { name: "Upload for review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review your receipt" }),
  ).toBeVisible();
  await page.getByLabel("Store", { exact: true }).fill("QA reviewed groceries");
  await page.getByLabel("Item name", { exact: true }).fill(item.name);
  // Set the receipt currency explicitly; country defaults need not match a receipt.
  await page
    .getByRole("combobox", { name: "Currency", exact: true })
    .selectOption("USD");
  await page.getByLabel("Price per unit (USD)").fill("5");
  await page.getByLabel("Pantry food").selectOption(item.food_id);
  await page
    .getByLabel("Total food weight (g)")
    .fill(String(Number(item.amount) + 100));
  await page
    .getByLabel("Fulfill a grocery requirement (optional)")
    .selectOption(item.id);
  await page.getByLabel("Receipt total (USD)").fill("5");
  await page
    .getByRole("button", { name: "Confirm receipt", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Receipt confirmed" }),
  ).toHaveCount(0);
  const reviewed = await (await page.request.get("/api/export")).json();
  expect(reviewed.purchases).toHaveLength(before.purchases.length);
  expect(reviewed.pantry_items).toEqual(before.pantry_items);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/receipt-review-mobile.png",
    fullPage: true,
  });
  await page.getByLabel(/I reviewed every line/).check();
  await page
    .getByRole("button", { name: "Confirm receipt", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Receipt confirmed" }),
  ).toBeVisible();
  const after = await (await page.request.get("/api/export")).json();
  expect(after.purchases).toHaveLength(before.purchases.length + 1);
  expect(
    after.shopping_list_items.find((i: { id: string }) => i.id === item.id)
      .fulfillment,
  ).toBe("purchased");
  const prior =
    before.pantry_items.find(
      (i: { food_id: string }) => i.food_id === item.food_id,
    )?.quantity_g || 0;
  expect(
    Number(
      after.pantry_items.find(
        (i: { food_id: string }) => i.food_id === item.food_id,
      ).quantity_g,
    ),
  ).toBeCloseTo(Number(prior) + Number(item.amount) + 100, 2);
  const receipt = after.purchases.find(
    (p: { origin: string }) => p.origin === "receipt",
  );
  await page.reload();
  await page.getByLabel("Continue a previous receipt").selectOption(receipt.id);
  await expect(
    page.getByRole("heading", { name: "Receipt confirmed" }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/export")).json()).purchases,
  ).toHaveLength(after.purchases.length);
  await page.goto("/prep");
  const checkbox = page.locator('.prep-task input[type="checkbox"]').first();
  await expect(checkbox).toBeChecked();
  await page.route("**/prep", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 500,
        contentType: "text/plain",
        body: "QA simulated save failure",
      });
    } else await route.continue();
  });
  await checkbox.click();
  await expect(
    page.locator(".prep-session .error-text[role=alert]"),
  ).toBeVisible();
  await expect(checkbox).toBeChecked();
  await page.unroute("**/prep");
  await checkbox.click();
  await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toBeEnabled();
  await page.reload();
  await expect(checkbox).not.toBeChecked();
});
