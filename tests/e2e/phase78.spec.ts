import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { addDays } from "@/lib/date";
const qa = JSON.parse(readFileSync(".env.qa", "utf8"));
test("progress, private photos, and meal prep", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/progress");
  await expect(
    page.getByRole("heading", { name: "Weekly summary" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Keep logging for a little longer to estimate your goal timeline.",
    ),
  ).toBeVisible();
  const date = await page.getByLabel("Weigh-in date").inputValue();
  for (const offset of [-21, -14, -7]) {
    await page.getByLabel("Weigh-in date").fill(addDays(date, offset));
    await page.getByRole("button", { name: "Log weight", exact: true }).click();
    await page
      .getByLabel("Weight (lb)", { exact: true })
      .fill((165 - offset * 0.05).toFixed(1));
    await page
      .getByRole("button", { name: "Save weight", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Weight history in pounds" }),
  ).toBeVisible();
  await expect(page.locator(".recharts-reference-line line")).toHaveAttribute(
    "stroke-dasharray",
    "3 3",
  );
  await expect(page.getByText("Goal", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/progress78-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Add measurements", exact: true })
    .click();
  await page.getByLabel("Waist (in)", { exact: true }).fill("32");
  await page
    .getByRole("button", { name: "Save measurements", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  let data = await (await page.request.get("/api/export")).json();
  expect(Number(data.body_measurements[0].waist)).toBeCloseTo(81.28);
  await page.getByText("Measurement history", { exact: true }).click();
  await page
    .getByRole("button", { name: "Edit measurements", exact: true })
    .click();
  await page.getByLabel("Waist (in)", { exact: true }).fill("31");
  await page
    .getByRole("button", { name: "Save measurements", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  data = await (await page.request.get("/api/export")).json();
  expect(Number(data.body_measurements[0].waist)).toBeCloseTo(78.74);
  await page
    .getByRole("button", { name: "Edit measurements", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete measurements", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/progress78-mobile.png",
    fullPage: true,
  });
  await page.goto("/progress/photos");
  for (const pose of ["front", "side"]) {
    await page
      .getByRole("button", { name: "Add progress photo", exact: true })
      .click();
    await page.getByLabel("Choose image").setInputFiles({
      name: `${pose}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC9sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page
      .getByRole("combobox", { name: "View", exact: true })
      .selectOption(pose);
    await page.getByRole("button", { name: "Save photo", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await expect(
    page.getByRole("heading", { name: "Side-by-side comparison" }),
  ).toBeVisible();
  data = await (await page.request.get("/api/export")).json();
  const photos = data.user_uploads.filter(
    (u: { bucket: string }) => u.bucket === "progress-photos",
  );
  expect(photos).toHaveLength(2);
  expect((await page.request.get(`/api/media/${photos[0].id}`)).status()).toBe(
    200,
  );
  expect((await request.get(`/api/media/${photos[0].id}`)).status()).toBe(401);
  await page.screenshot({
    path: "test-results/photos78-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Delete photo", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".photo-grid article")).toHaveCount(1);
  await page.goto("/prep");
  await page
    .getByRole("button", { name: "Create prep session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Build prep tasks", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".prep-task")).not.toHaveCount(0);
  const before = await (await page.request.get("/api/export")).json();
  for (const checkbox of await page
    .locator(".prep-task input[type=checkbox]")
    .all()) {
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toBeEnabled();
  }
  await expect(
    page.getByRole("heading", { name: "Meal prep · Complete", exact: true }),
  ).toBeVisible();
  const after = await (await page.request.get("/api/export")).json();
  expect(after.pantry_items).toEqual(before.pantry_items);
  expect(after.pantry_movements).toEqual(before.pantry_movements);
  expect(after.meal_prep_sessions).toHaveLength(1);
  await page.screenshot({
    path: "test-results/prep78-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/prep78-desktop.png" });
  expect(errors).toEqual([]);
});

test("nutrition label manual review creates a private food", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/scan/label");
  await page
    .getByLabel("Choose image")
    .setInputFiles({
      name: "label.png",
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
    page.getByRole("heading", { name: "Review the nutrition label" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Automatic extraction is not configured/),
  ).toBeVisible();
  const values = {
    name: "QA reviewed snack",
    servingSize: "40",
    servingUnit: "g",
    servingGrams: "40",
    servingsPerContainer: "5",
    calories: "160",
    protein: "8",
    carbs: "20",
    fat: "5",
    fiber: "3",
    sugar: "4",
    sodium: "100",
  };
  for (const [name, value] of Object.entries(values))
    await page.locator(`input[name="${name}"]`).fill(value);
  await page
    .getByRole("button", { name: "Confirm and save food", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reviewed food saved" }),
  ).toHaveCount(0);
  await page.getByRole("checkbox").check();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/label78-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirm and save food", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reviewed food saved" }),
  ).toBeVisible();
  const exported = await (await page.request.get("/api/export")).json();
  const food = exported.private_foods.find(
    (f: { name: string }) => f.name === "QA reviewed snack",
  );
  expect(food).toBeTruthy();
  expect(Number(food.food_nutrition.calories)).toBe(400);
});
