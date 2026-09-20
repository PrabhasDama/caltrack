import type {
  GroceryDataProvider,
  NearbyQuery,
  ProviderProduct,
  ProviderResult,
  ProviderStore,
  Environment,
  ProviderFailure,
} from "./types";
import { normalizeKrogerProduct, normalizeKrogerStore } from "./normalization";
type Options = {
  clientId?: string;
  clientSecret?: string;
  environment?: Environment;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  ttlMs?: number;
  diagnostic?: (event: Record<string, string | number | boolean>) => void;
};
class Failure extends Error {
  constructor(readonly result: ProviderFailure) {
    super(result.message);
  }
}
const fail = (code: ProviderFailure["code"], message: string) =>
  new Failure({ ok: false, code, message });
export class KrogerProvider implements GroceryDataProvider {
  readonly name = "kroger";
  readonly environment: Environment;
  private token?: { value: string; expires: number };
  private tokenPending?: Promise<string>;
  private cache = new Map<
    string,
    { expires: number; value: ProviderResult<unknown> }
  >();
  private pending = new Map<string, Promise<ProviderResult<unknown>>>();
  private priceSeen = false;
  private fetcher: typeof fetch;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;
  private base: string;
  constructor(private options: Options) {
    this.environment = options.environment || "certification";
    this.base =
      this.environment === "production"
        ? "https://api.kroger.com"
        : "https://api-ce.kroger.com";
    this.fetcher = options.fetch || fetch;
    this.now = options.now || Date.now;
    this.sleep =
      options.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  }
  capabilities() {
    const c =
      this.options.clientId && this.options.clientSecret
        ? ("supported" as const)
        : ("unavailable" as const);
    return {
      storeLocations: c,
      productCatalog: c,
      inventory: c,
      pricing: this.priceSeen
        ? ("supported" as const)
        : ("unverified" as const),
    };
  }
  private async request(
    path: string,
    init: RequestInit,
    operation: string,
  ): Promise<unknown> {
    const started = this.now();
    let status = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await this.fetcher(this.base + path, {
          ...init,
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(this.options.timeoutMs || 10000),
        });
        status = r.status;
        if (r.ok) {
          const data = await r.json();
          this.options.diagnostic?.({
            provider: this.name,
            operation,
            success: true,
            status,
            latencyMs: this.now() - started,
            attempt,
          });
          return data;
        }
        if (r.status === 401 || r.status === 403)
          throw fail(
            "unauthorized",
            "Kroger access was not authorized. Check provider configuration.",
          );
        if (r.status === 429 || r.status >= 500) {
          if (attempt < 2) {
            const retry = Number(r.headers.get("retry-after"));
            await this.sleep(
              Math.min(
                2000,
                Number.isFinite(retry) && retry > 0
                  ? retry * 1000
                  : 300 * 2 ** attempt,
              ),
            );
            continue;
          }
          throw fail(
            r.status === 429 ? "rate_limited" : "unavailable",
            r.status === 429
              ? "Kroger is rate limited. Try again later."
              : "Kroger is temporarily unavailable. Try again later.",
          );
        }
        throw fail("invalid", "Kroger could not complete this request.");
      } catch (e) {
        if (e instanceof Failure) {
          this.options.diagnostic?.({
            provider: this.name,
            operation,
            success: false,
            status,
            latencyMs: this.now() - started,
          });
          throw e;
        }
        if (attempt < 2) {
          await this.sleep(300 * 2 ** attempt);
          continue;
        }
        throw fail(
          e instanceof Error && ["TimeoutError", "AbortError"].includes(e.name)
            ? "timeout"
            : "unavailable",
          "Kroger did not respond. Please try again.",
        );
      }
    }
    throw fail("unavailable", "Kroger is unavailable.");
  }
  private async accessToken() {
    if (!this.options.clientId || !this.options.clientSecret)
      throw fail(
        "unconfigured",
        "Kroger is not configured. You can still shop and enter actual prices.",
      );
    if (this.token && this.token.expires > this.now()) return this.token.value;
    if (this.tokenPending) return this.tokenPending;
    this.tokenPending = (async () => {
      const r = (await this.request(
        "/v1/connect/oauth2/token",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            scope: "product.compact",
          }),
        },
        "oauth",
      )) as { access_token?: string; expires_in?: number };
      if (!r.access_token || !Number.isFinite(Number(r.expires_in)))
        throw fail(
          "unavailable",
          "Kroger returned an invalid authorization response.",
        );
      this.token = {
        value: r.access_token,
        expires: this.now() + Math.max(1, Number(r.expires_in) - 60) * 1000,
      };
      return r.access_token;
    })();
    try {
      return await this.tokenPending;
    } finally {
      this.tokenPending = undefined;
    }
  }
  private async read<T>(
    path: string,
    operation: string,
    normalize: (value: unknown, stamp: string) => T,
    refresh = false,
  ): Promise<ProviderResult<T>> {
    const hit = this.cache.get(path);
    if (!refresh && hit && hit.expires > this.now()) {
      this.options.diagnostic?.({
        provider: this.name,
        operation,
        cacheHit: true,
      });
      return { ...hit.value, cached: true } as ProviderResult<T>;
    }
    if (this.pending.has(path))
      return this.pending.get(path)! as Promise<ProviderResult<T>>;
    const work = (async (): Promise<ProviderResult<T>> => {
      try {
        const token = await this.accessToken();
        const raw = await this.request(
          path,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          },
          operation,
        );
        const stamp = new Date(this.now()).toISOString();
        const data = normalize(raw, stamp);
        this.options.diagnostic?.({
          provider: this.name,
          operation,
          cacheHit: false,
          records: Array.isArray(data) ? data.length : 1,
        });
        return { ok: true, data, retrievedAt: stamp };
      } catch (e) {
        return e instanceof Failure
          ? e.result
          : {
              ok: false,
              code: "unavailable",
              message: "Kroger returned an unexpected response.",
            };
      }
    })();
    this.pending.set(path, work);
    try {
      const value = await work;
      if (this.cache.size >= 200)
        this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(path, {
        value,
        expires: this.now() + (value.ok ? this.options.ttlMs || 300000 : 15000),
      });
      return value;
    } finally {
      this.pending.delete(path);
    }
  }
  getNearbyStores(q: NearbyQuery): Promise<ProviderResult<ProviderStore[]>> {
    if (
      (!q.origin && !/^\d{5}$/.test(q.postalCode || "")) ||
      !Number.isFinite(q.radiusMiles) ||
      q.radiusMiles < 1 ||
      q.radiusMiles > 50 ||
      (q.origin &&
        (!Number.isFinite(q.origin.latitude) ||
          !Number.isFinite(q.origin.longitude) ||
          Math.abs(q.origin.latitude) > 90 ||
          Math.abs(q.origin.longitude) > 180))
    )
      return Promise.resolve({
        ok: false,
        code: "invalid",
        message:
          "Use a US ZIP code or valid coordinates and a 1–50 mile radius.",
      });
    const params = new URLSearchParams({
      "filter.radiusInMiles": String(q.radiusMiles),
      "filter.limit": "20",
      ...(q.origin
        ? {
            "filter.latLong.near": `${q.origin.latitude},${q.origin.longitude}`,
          }
        : { "filter.zipCode.near": q.postalCode! }),
    });
    return this.read(`/v1/locations?${params}`, "locations", (r, stamp) => {
      const rows = (r as { data?: unknown[] }).data;
      if (!Array.isArray(rows)) throw Error();
      return rows
        .map((v) => normalizeKrogerStore(v, this.environment, stamp, q.origin))
        .filter((v): v is ProviderStore => !!v);
    });
  }
  private products(path: string, locationId: string, refresh = false) {
    return this.read(
      path,
      "products",
      (r, stamp) => {
        const raw = (r as { data?: unknown }).data;
        if (!raw) throw Error();
        const rows = (Array.isArray(raw) ? raw : [raw]).flatMap((p) =>
          normalizeKrogerProduct(p, locationId, this.environment, stamp),
        );
        if (rows.some((p) => p.effectivePrice !== null)) this.priceSeen = true;
        return rows;
      },
      refresh,
    );
  }
  searchProducts(
    term: string,
    locationId: string,
    refresh = false,
  ): Promise<ProviderResult<ProviderProduct[]>> {
    if (
      !/^\d{1,20}$/.test(locationId) ||
      term.trim().length < 2 ||
      term.length > 100
    )
      return Promise.resolve({
        ok: false,
        code: "invalid",
        message: "Choose a location and enter 2–100 search characters.",
      });
    return this.products(
      `/v1/products?${new URLSearchParams({ "filter.term": term.trim(), "filter.locationId": locationId, "filter.limit": "12" })}`,
      locationId,
      refresh,
    );
  }
  getProduct(
    id: string,
    locationId: string,
  ): Promise<ProviderResult<ProviderProduct[]>> {
    if (!/^\d{1,20}$/.test(id) || !/^\d{1,20}$/.test(locationId))
      return Promise.resolve({
        ok: false,
        code: "invalid",
        message: "Invalid product or location.",
      });
    return this.products(
      `/v1/products/${id}?filter.locationId=${locationId}`,
      locationId,
    );
  }
  async getOffers(term: string, locationId: string) {
    const r = await this.searchProducts(term, locationId);
    return r.ok
      ? { ...r, data: r.data.filter((p) => p.effectivePrice !== null) }
      : r;
  }
  getAvailability(id: string, locationId: string) {
    return this.getProduct(id, locationId);
  }
}
