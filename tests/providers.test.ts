import { describe, it, expect, vi } from "vitest";
import { KrogerProvider } from "../lib/providers/kroger";
import {
  normalizeKrogerProduct,
  normalizeKrogerStore,
  packageSize,
  finitePrice,
  straightLineMiles,
} from "../lib/providers/normalization";
import { productMatch } from "../lib/providers/matching";
import { priceMeaning } from "../lib/pricing/semantics";
import { unitPrices } from "../lib/pricing/calculations";
import { compareCarts, type Offer } from "../lib/optimization/engine";
const stamp = "2026-09-18T12:00:00Z";
// Minimal public fields actually observed from Kroger Certification on 2026-09-18.
const eggs = {
  productId: "0001111090406",
  upc: "0001111090406",
  brand: "Kroger",
  description: "Kroger® Grade AA Cage Free Large White Eggs",
  items: [
    {
      itemId: "0001111090406",
      inventory: { stockLevel: "HIGH" },
      fulfillment: { inStore: true },
      size: "12 ct",
    },
  ],
};
const cheese = {
  productId: "0001111001798",
  upc: "0001111001798",
  brand: "Kroger",
  description: "Kroger® Whole Milk Shredded Mozzarella Cheese",
  items: [
    {
      itemId: "0001111001798",
      size: "8 oz",
      soldBy: "UNIT",
      inventory: { stockLevel: "HIGH" },
      price: { regular: 3.29 },
    },
  ],
};
const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function setup(responses: Response[], options: Record<string, unknown> = {}) {
  const f = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
    void _url;
    void _init;
    return responses.shift() || json({ data: [eggs] });
  });
  const sleep = vi.fn(async () => {});
  const events: unknown[] = [];
  const p = new KrogerProvider({
    clientId: "client",
    clientSecret: "private-test-secret",
    fetch: f as typeof fetch,
    sleep,
    diagnostic: (e) => events.push(e),
    ...options,
  });
  return { p, f, sleep, events };
}
const token = () =>
  json({ access_token: "private-test-token", expires_in: 3600 });
describe("Kroger transport", () => {
  it("authenticates once, deduplicates concurrent reads and retains source timestamps", async () => {
    const { p, f, events } = setup([token(), json({ data: [eggs] })]);
    const r = await Promise.all([
      p.searchProducts("eggs", "70300186"),
      p.searchProducts("eggs", "70300186"),
    ]);
    await p.searchProducts("eggs", "70300186");
    expect(f).toHaveBeenCalledTimes(2);
    expect(r[0]).toEqual(r[1]);
    expect(JSON.stringify(events)).not.toMatch(/private-test|Authorization/);
    expect(String(f.mock.calls[0]?.[0])).toContain("oauth2/token");
  });
  it("renews an expired token and keeps location-specific cache entries separate", async () => {
    let now = 0;
    const { p, f } = setup(
      [
        token(),
        json({ data: [eggs] }),
        json({ data: [eggs] }),
        token(),
        json({ data: [eggs] }),
      ],
      { now: () => now },
    );
    await p.searchProducts("eggs", "70300186");
    await p.searchProducts("eggs", "70400762");
    now = 3600000;
    await p.searchProducts("eggs", "70300186");
    expect(f).toHaveBeenCalledTimes(5);
  });
  it("retries a transient 503 with a bounded delay", async () => {
    const { p, f, sleep } = setup([
      token(),
      json({}, 503),
      json({ data: [cheese] }),
    ]);
    expect((await p.searchProducts("cheese", "70300186")).ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(300);
  });
  it("bounds 429 retries and caches the failure briefly", async () => {
    const { p, f } = setup([
      token(),
      json({}, 429),
      json({}, 429),
      json({}, 429),
    ]);
    expect(await p.searchProducts("eggs", "70300186")).toMatchObject({
      ok: false,
      code: "rate_limited",
    });
    await p.searchProducts("eggs", "70300186");
    expect(f).toHaveBeenCalledTimes(4);
  });
  it("does not retry credential failures", async () => {
    const { p, f } = setup([json({}, 401)]);
    expect(await p.searchProducts("eggs", "70300186")).toMatchObject({
      ok: false,
      code: "unauthorized",
    });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("times out without exposing tokens or raw provider errors", async () => {
    const f = vi
      .fn()
      .mockRejectedValue(new DOMException("secret body", "TimeoutError"));
    const p = new KrogerProvider({
      clientId: "c",
      clientSecret: "s",
      fetch: f,
      sleep: async () => {},
    });
    expect(await p.searchProducts("eggs", "70300186")).toMatchObject({
      ok: false,
      code: "timeout",
    });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("makes no network request when credentials are missing", async () => {
    const f = vi.fn();
    const p = new KrogerProvider({ fetch: f });
    expect(await p.searchProducts("eggs", "70300186")).toMatchObject({
      ok: false,
      code: "unconfigured",
    });
    expect(f).not.toHaveBeenCalled();
  });
  it("validates ZIP, coordinates, radius and product identifiers before network calls", async () => {
    const { p, f } = setup([]);
    expect(
      (await p.getNearbyStores({ postalCode: "bad", radiusMiles: 10 })).ok,
    ).toBe(false);
    expect(
      (
        await p.getNearbyStores({
          origin: { latitude: 200, longitude: 0 },
          radiusMiles: 10,
        })
      ).ok,
    ).toBe(false);
    expect((await p.getProduct("../token", "70300186")).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("normalizes full details and reports price capability only after observing a price", async () => {
    const { p } = setup([token(), json({ data: cheese })]);
    expect(p.capabilities().pricing).toBe("unverified");
    const r = await p.getProduct(cheese.productId, "70300186");
    expect(r).toMatchObject({
      ok: true,
      data: [{ regularPrice: 3.29, providerLocationId: "70300186" }],
    });
    expect(p.capabilities().pricing).toBe("supported");
  });
});
describe("honest normalization and matching", () => {
  it("preserves missing price from the observed eggs payload", () => {
    expect(
      normalizeKrogerProduct(eggs, "70300186", "certification", stamp)[0],
    ).toMatchObject({
      effectivePrice: null,
      regularPrice: null,
      packageAmount: 12,
      packageGrams: null,
      availability: "in_stock",
      environment: "certification",
      upc: eggs.upc,
    });
  });
  it("uses item price, not a hypothetical top-level price", () => {
    const p = normalizeKrogerProduct(
      { ...eggs, price: 9 },
      "1",
      "production",
      stamp,
    )[0];
    expect(p.effectivePrice).toBeNull();
    expect(
      normalizeKrogerProduct(cheese, "1", "production", stamp)[0]
        .effectivePrice,
    ).toBe(3.29);
  });
  it("normalizes valid promo prices and ignores absent promo zero", () => {
    const raw = {
      ...cheese,
      items: [
        { ...cheese.items[0], price: { regular: "4.99", promo: "3.99" } },
      ],
    };
    expect(
      normalizeKrogerProduct(raw, "1", "production", stamp)[0],
    ).toMatchObject({
      effectivePrice: 3.99,
      regularPrice: 4.99,
      promoPrice: 3.99,
    });
    raw.items[0].price.promo = "0";
    expect(
      normalizeKrogerProduct(raw, "1", "production", stamp)[0].effectivePrice,
    ).toBe(4.99);
  });
  it("does not invent unknown prices, density, weight or package units", () => {
    for (const v of [null, undefined, "", false, "bad", -1])
      expect(finitePrice(v)).toBeNull();
    expect(finitePrice(0)).toBe(0);
    expect(packageSize("1 gal").grams).toBeNull();
    expect(packageSize("18 ct")).toMatchObject({
      amount: 18,
      unit: "piece",
      grams: null,
    });
    expect(packageSize("2 lb").grams).toBeCloseTo(907.185, 3);
    expect(packageSize("16 fl oz").grams).toBeNull();
  });
  it("excludes a price with an unknown selling basis", () => {
    const p = normalizeKrogerProduct(
      { ...cheese, items: [{ ...cheese.items[0], soldBy: "WEIGHT" }] },
      "1",
      "production",
      stamp,
    )[0];
    expect(p.effectivePrice).toBeNull();
    expect(p.regularPrice).toBe(3.29);
  });
  it("keeps unavailable and unknown inventory distinct", () => {
    for (const [raw, want] of [
      ["TEMPORARILY_OUT_OF_STOCK", "out_of_stock"],
      ["LOW", "low_stock"],
      [undefined, "unknown"],
    ])
      expect(
        normalizeKrogerProduct(
          {
            ...eggs,
            items: [{ ...eggs.items[0], inventory: { stockLevel: raw } }],
          },
          "1",
          "production",
          stamp,
        )[0].availability,
      ).toBe(want);
  });
  it("retains real location identity and labels geometric distance", () => {
    const s = normalizeKrogerStore(
      {
        locationId: "70300186",
        name: "Ralphs - Traffic Circle",
        chain: "RALPHS",
        address: { addressLine1: "1930 N Lakewood Blvd", zipCode: "90815" },
        geolocation: { latitude: 33.7921389, longitude: -118.1414178 },
      },
      "certification",
      stamp,
      { latitude: 33.8, longitude: -118.14 },
    )!;
    expect(s.providerLocationId).toBe("70300186");
    expect(s.distanceKind).toBe("straight_line");
    expect(s.distanceMiles).toBeGreaterThan(0);
    expect(
      straightLineMiles(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 0 },
      ),
    ).toBe(0);
  });
  it("requires review for milk versus cheese and other materially different foods", () => {
    for (const [name, candidate] of [
      ["Milk", cheese.description],
      ["Chicken breast", "Chicken thighs"],
      ["Plain Greek yogurt", "Sweetened vanilla yogurt"],
      ["Brown rice", "Cauliflower rice"],
    ])
      expect(productMatch({ name }, { name: candidate }).review).toBe(true);
  });
  it("prioritizes UPC and exact brand/product/package, and distinguishes egg counts", () => {
    expect(
      productMatch({ name: "Eggs", upc: "00123" }, { name: "Eggs", upc: "123" })
        .method,
    ).toBe("upc");
    expect(
      productMatch(
        { name: "Eggs", brand: "Kroger", packageSize: "12 ct" },
        { name: "Eggs", brand: "Kroger", packageSize: "12 ct" },
      ).review,
    ).toBe(false);
    expect(
      productMatch(
        { name: "Eggs", brand: "Kroger", packageSize: "12 ct" },
        { name: "Eggs", brand: "Kroger", packageSize: "18 ct" },
      ).review,
    ).toBe(true);
  });
  it("uses configurable freshness, preserves legitimate zero and blocks certification quotes", () => {
    const base = {
      price: 0,
      currency: "USD" as const,
      source: "provider",
      observedAt: stamp,
    };
    const now = Date.parse(stamp);
    expect(priceMeaning(base, now).amount.replace(/\s/g, " ")).toBe("USD 0.00");
    expect(priceMeaning({ ...base, price: null }, now).amount).toBe(
      "Price unavailable",
    );
    expect(priceMeaning(base, now + 2 * 3600000).state).toBe("recent");
    expect(priceMeaning(base, now + 2 * 86400000).eligible).toBe(false);
    expect(
      priceMeaning({ ...base, environment: "certification" }, now).label,
    ).toContain("needs confirmation");
    expect(
      priceMeaning({ ...base, available: "out_of_stock" }, now).eligible,
    ).toBe(false);
    expect(unitPrices(4, 400)?.per100g).toBe(1);
  });
});
describe("location-based optimizer", () => {
  const offer = (id: string, food: string, price: number): Offer => ({
    id,
    source: "provider",
    price,
    currency: "USD",
    is_demo: false,
    provider: "kroger",
    promotion: null,
    observed_at: stamp,
    product: {
      id: food,
      food_id: food,
      name: food,
      package_amount: 500,
      package_unit: "g",
      package_grams: 500,
    },
    location: {
      id,
      store_id: "chain",
      name: id === "a" ? "Ralphs - Traffic Circle" : "Ralphs - Other branch",
      currency: "USD",
      country_code: "US",
      is_demo: false,
    },
  });
  const data = {
    offers: [offer("a", "rice", 3), offer("b", "rice", 4)],
    spent: 0,
    shoppingDays: 0,
    preferredStores: [],
    distancesKm: {},
    maxStores: 2,
    extraStorePenalty: 0,
    travelCostPerKm: 0,
  };
  it("compares actual locations, preserving product package and source", () => {
    const r = compareCarts(
      [{ food_id: "rice", name: "rice", grams: 600 }],
      data,
      "USD",
    );
    expect(r.bestSplit.total).toBe(6);
    expect(r.bestSplit.stores).toEqual(["a"]);
    expect(r.bestSplit.lines[0].packages[0].offer.location.name).toBe(
      "Ralphs - Traffic Circle",
    );
  });
  it("does not fabricate a complete total or savings with missing prices", () => {
    const r = compareCarts(
      [
        { food_id: "rice", name: "rice", grams: 500 },
        { food_id: "eggs", name: "eggs", grams: 500 },
      ],
      data,
      "USD",
    );
    expect(r.bestSplit.total).toBeNull();
    expect(r.savings).toBeNull();
    expect(r.bestSplit.missing.map((m) => m.name)).toContain("eggs");
  });
  it("reports no usable prices without a zero-dollar recommendation", () => {
    const r = compareCarts(
      [{ food_id: "rice", name: "rice", grams: 500 }],
      { ...data, offers: [] },
      "USD",
    );
    expect(r.bestSplit.total).toBeNull();
    expect(r.savings).toBeNull();
  });
});
