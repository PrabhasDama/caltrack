import { claimCelebration } from "@/lib/feedback";
import { expect, it, describe } from "vitest";
import { weeklyMealTimes, timeParts } from "@/lib/progress/meal-times";
import { formatFoodQuantity, formatWeight } from "@/lib/food/quantities";
import { extractWithGateway } from "@/lib/scanning/providers";
describe("practical quantities and meal timing", () => {
  it("uses natural fractions and never zero for small discrete portions", () => {
    const f = { name: "Bananas", natural_unit: "banana", natural_unit_g: 118 };
    expect(formatFoodQuantity(59, f, "imperial")).toBe("1/2 banana");
    expect(formatFoodQuantity(1, f)).toBe("<1/4 banana");
    expect(formatFoodQuantity(59, f, "metric", true)).toBe("1 banana");
    expect(formatFoodQuantity(13.5, { name: "Olive oil" })).toBe("1 tbsp");
    expect(formatWeight(114, "imperial")).toBe("4 oz");
    expect(formatWeight(114, "metric")).toBe("110 g");
  });
  it("uses actual timezone-local timestamps and excludes unknown or undone completions", () => {
    expect(timeParts("2026-09-07T01:30:00Z", "America/Los_Angeles")).toEqual({
      date: "2026-09-06",
      minutes: 1110,
    });
    expect(
      weeklyMealTimes(
        [
          {
            status: "planned",
            slot: "Lunch",
            completed_at: "2026-09-06T12:00:00Z",
          },
          { status: "completed", slot: "Lunch", completed_at: null },
        ],
        "2026-09-06",
        "UTC",
      )[1].current,
    ).toBeNull();
  });
  it("compares sufficient weekly samples and handles midnight circularly", () => {
    const meals = [
      "2026-09-01T23:55:00Z",
      "2026-09-02T00:05:00Z",
      "2026-09-03T00:00:00Z",
      "2026-08-25T23:25:00Z",
      "2026-08-26T23:35:00Z",
      "2026-08-27T23:30:00Z",
    ].map((t) => ({ status: "completed", slot: "Dinner", completed_at: t }));
    const d = weeklyMealTimes(meals, "2026-09-06", "UTC")[2];
    expect(d.current?.range).toBe(10);
    expect(d.current?.typical).toBe(0);
    expect(d.shift).toBe(30);
  });
});
describe("configured extraction boundary", () => {
  const image = new Blob(["fixture"], { type: "image/png" });
  it("keeps unreadable fields blank, does not save, and preserves credible candidates", async () => {
    const response = async () =>
      new Response(
        JSON.stringify({
          fields: {
            name: { value: "Snack", confidence: 0.99 },
            calories: { value: 140, confidence: 0.9 },
            protein: { value: 12, confidence: 0.5 },
          },
        }),
      );
    const r = await extractWithGateway(
      "label",
      image,
      { url: "https://example.invalid/extract", token: "test" },
      response as typeof fetch,
    );
    expect(r).toMatchObject({
      status: "extracted",
      candidate: {
        name: "Snack",
        calories: 140,
        protein: null,
        servingGrams: null,
      },
    });
  });
  it("falls back to manual entry for timeout, malformed output and insecure endpoints", async () => {
    const failures = [
      async () => {
        throw new Error("timeout");
      },
      async () => new Response("broken"),
    ];
    for (const send of failures)
      expect(
        await extractWithGateway(
          "label",
          image,
          { url: "https://example.invalid", token: "test" },
          send as typeof fetch,
        ),
      ).toMatchObject({ status: "unavailable", candidate: null });
    expect(
      await extractWithGateway("label", image, {
        url: "http://example.invalid",
        token: "test",
      }),
    ).toMatchObject({ status: "unavailable" });
  });
});

it("claims a celebration only once per user and day", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
  expect(claimCelebration("user:day", storage)).toBe(true);
  expect(claimCelebration("user:day", storage)).toBe(false);
  expect(claimCelebration("user:next", storage)).toBe(true);
});
