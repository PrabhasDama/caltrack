import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const a = JSON.parse(readFileSync(".env.qa", "utf8")),
  b = JSON.parse(readFileSync(".env.qa-second", "utf8"));
test("logout and switching users never reuse private cached pages", async ({
  page,
}) => {
  const login = async (u: typeof a) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(u.email);
    await page.getByLabel("Password", { exact: true }).fill(u.password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
  };
  await login(a);
  await expect(page).toHaveURL(/\/dashboard/);
  for (const path of ["/plan", "/groceries", "/pantry", "/budget"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto("/settings");
  await page.getByRole("main").getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(b);
  await expect(page).toHaveURL(/\/onboarding/);
  for (const path of ["/plan", "/groceries", "/pantry", "/budget"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(
      page.getByText("QA Phase 9 lifecycle", { exact: true }),
    ).toHaveCount(0);
  }
  const d = await (await page.request.get("/api/export")).json();
  expect(d.profiles[0].id).toBe(b.id);
  for (const table of [
    "pantry_items",
    "shopping_list_items",
    "purchases",
    "daily_meal_logs",
    "food_waste_events",
    "receipt_price_observations",
  ])
    expect(d[table]).toEqual([]);
});
