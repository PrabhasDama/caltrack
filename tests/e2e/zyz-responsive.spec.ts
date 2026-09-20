import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const qa = JSON.parse(readFileSync(".env.qa", "utf8"));
test("critical routes remain usable on mobile and tablet", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      "dashboard",
      "plan",
      "groceries",
      "stores",
      "pantry",
      "budget",
      "progress",
      "settings",
      "preferences",
    ]) {
      await page.goto(`/${route}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("main")).not.toContainText(
        "Application error",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} overflow at ${width}px`,
      ).toBe(true);
      await page.screenshot({
        path: `test-results/responsive-${route}-${width}.png`,
      });
    }
  }
  expect(errors).toEqual([]);
});
