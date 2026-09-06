// Run against a disposable, onboarded QA account. No credentials are printed.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const qa = JSON.parse(readFileSync(".env.qa", "utf8"));
const base = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  await page.getByLabel("Email address").fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard");
  const output = {};
  for (const path of [
    "/dashboard",
    "/plan",
    "/groceries",
    "/pantry",
    "/budget",
    "/progress",
    "/prep",
  ]) {
    const samples = [];
    for (let i = 0; i < 4; i++) {
      const start = performance.now();
      const r = await context.request.get(`${base}${path}`);
      await r.body();
      if (!r.ok()) throw new Error(`${path}: ${r.status()}`);
      if (i) samples.push(Math.round(performance.now() - start));
    }
    output[path] = {
      samplesMs: samples,
      medianMs: [...samples].sort((a, b) => a - b)[1],
    };
  }
  console.log(JSON.stringify(output, null, 2));
} finally {
  await browser.close();
}
