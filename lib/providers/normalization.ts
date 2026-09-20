import type {
  Availability,
  Coordinates,
  Environment,
  ProviderProduct,
  ProviderStore,
} from "./types";
export const finitePrice = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean")
    return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1000000 ? n : null;
};
export function packageSize(size: string) {
  const m = size
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)\s*(kg|g|oz|lb|lbs|ct|count|ml|l|fl oz)$/);
  if (!m || Number(m[1]) <= 0) return { amount: null, unit: null, grams: null };
  const amount = Number(m[1]),
    unit =
      ({ ct: "piece", count: "piece", lbs: "lb" } as Record<string, string>)[
        m[2]
      ] || m[2];
  const factor = (
    { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 } as Record<
      string,
      number
    >
  )[unit];
  return {
    amount,
    unit: unit === "fl oz" ? "ml" : unit,
    grams: factor ? Math.round(amount * factor * 1000) / 1000 : null,
    ...(unit === "fl oz"
      ? { amount: Math.round(amount * 29.5735295625 * 1000) / 1000 }
      : {}),
  };
}
export function straightLineMiles(a: Coordinates, b: Coordinates) {
  const rad = (n: number) => (n * Math.PI) / 180,
    dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return (
    3958.7613 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
  );
}
type Raw = Record<string, unknown>;
const object = (v: unknown): Raw =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {};
const string = (v: unknown) => (typeof v === "string" ? v : "");
export function normalizeKrogerStore(
  value: unknown,
  environment: Environment,
  retrievedAt: string,
  origin?: Coordinates,
): ProviderStore | null {
  const r = object(value),
    a = object(r.address),
    g = object(r.geolocation);
  if (!string(r.locationId) || !string(r.name)) return null;
  const coordinates =
    typeof g.latitude === "number" &&
    typeof g.longitude === "number" &&
    Math.abs(g.latitude) <= 90 &&
    Math.abs(g.longitude) <= 180
      ? { latitude: g.latitude, longitude: g.longitude }
      : null;
  return {
    provider: "kroger",
    environment,
    providerLocationId: string(r.locationId),
    name: string(r.name),
    chain: string(r.chain),
    address: [a.addressLine1, a.city, a.state, a.zipCode]
      .filter(Boolean)
      .join(", "),
    postalCode: string(a.zipCode),
    coordinates,
    distanceMiles:
      origin && coordinates ? straightLineMiles(origin, coordinates) : null,
    distanceKind: origin && coordinates ? "straight_line" : "unknown",
    retrievedAt,
  };
}
export function normalizeKrogerProduct(
  value: unknown,
  locationId: string,
  environment: Environment,
  retrievedAt: string,
): ProviderProduct[] {
  const p = object(value);
  if (!string(p.productId) || !string(p.description)) return [];
  return (Array.isArray(p.items) ? p.items : []).map((v: unknown) => {
    const i = object(v),
      prices = object(i.price),
      stock = object(i.inventory).stockLevel,
      size = packageSize(string(i.size));
    const availability: Availability =
      stock === "HIGH"
        ? "in_stock"
        : stock === "LOW"
          ? "low_stock"
          : ["TEMPORARILY_OUT_OF_STOCK", "OUT_OF_STOCK"].includes(String(stock))
            ? "out_of_stock"
            : "unknown";
    const regular = finitePrice(prices.regular),
      promo = finitePrice(prices.promo);
    // Kroger uses promo=0 when there is no promotion; regular=0 remains a legitimate known price.
    const promoPrice =
      promo !== null && promo > 0 && (regular === null || promo < regular)
        ? promo
        : null;
    const priceBasis =
      i.soldBy === "UNIT" || (i.soldBy === undefined && size.amount !== null)
        ? "package"
        : "unknown";
    return {
      provider: "kroger",
      environment,
      providerProductId: string(p.productId),
      providerItemId: string(i.itemId) || string(p.productId),
      providerLocationId: locationId,
      upc: string(p.upc) || null,
      brand: string(p.brand),
      description: string(p.description),
      packageSize: string(i.size),
      packageAmount: size.amount,
      packageUnit: size.unit,
      packageGrams: size.grams,
      availability,
      regularPrice: regular,
      promoPrice,
      effectivePrice: priceBasis === "package" ? (promoPrice ?? regular) : null,
      currency: "USD" as const,
      retrievedAt,
      priceBasis,
    };
  });
}
