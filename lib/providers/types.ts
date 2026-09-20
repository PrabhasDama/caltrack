export type Capability = "supported" | "unavailable" | "unverified";
export type Availability =
  "in_stock" | "low_stock" | "out_of_stock" | "unknown";
export type Environment = "production" | "certification";
export type ProviderFailure = {
  ok: false;
  code:
    | "unconfigured"
    | "unauthorized"
    | "rate_limited"
    | "timeout"
    | "unavailable"
    | "invalid"
    | "unsupported";
  message: string;
};
export type ProviderResult<T> =
  | { ok: true; data: T; retrievedAt: string; cached?: boolean }
  | ProviderFailure;
export type Coordinates = { latitude: number; longitude: number };
export type NearbyQuery = {
  postalCode?: string;
  origin?: Coordinates;
  radiusMiles: number;
};
export type ProviderStore = {
  provider: string;
  environment: Environment;
  providerLocationId: string;
  name: string;
  chain: string;
  address: string;
  postalCode: string;
  coordinates: Coordinates | null;
  distanceMiles: number | null;
  distanceKind: "straight_line" | "provider" | "unknown";
  retrievedAt: string;
};
export type ProviderProduct = {
  provider: string;
  environment: Environment;
  providerProductId: string;
  providerItemId: string;
  providerLocationId: string;
  upc: string | null;
  brand: string;
  description: string;
  packageSize: string;
  packageAmount: number | null;
  packageUnit: string | null;
  packageGrams: number | null;
  availability: Availability;
  regularPrice: number | null;
  promoPrice: number | null;
  effectivePrice: number | null;
  currency: "USD" | "CAD";
  retrievedAt: string;
  priceBasis: "package" | "unknown";
};
export interface GroceryDataProvider {
  readonly name: string;
  capabilities(): {
    storeLocations: Capability;
    productCatalog: Capability;
    inventory: Capability;
    pricing: Capability;
  };
  getNearbyStores(query: NearbyQuery): Promise<ProviderResult<ProviderStore[]>>;
  searchProducts(
    term: string,
    locationId: string,
    refresh?: boolean,
  ): Promise<ProviderResult<ProviderProduct[]>>;
  getProduct(
    productId: string,
    locationId: string,
  ): Promise<ProviderResult<ProviderProduct[]>>;
  getOffers(
    term: string,
    locationId: string,
  ): Promise<ProviderResult<ProviderProduct[]>>;
  getAvailability(
    productId: string,
    locationId: string,
  ): Promise<ProviderResult<ProviderProduct[]>>;
}
