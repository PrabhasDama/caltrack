export type Currency = "USD" | "CAD";
export type RetailProduct = {
  id: string;
  food_id: string | null;
  name: string;
  package_amount: number | null;
  package_unit: string | null;
  package_grams: number | null;
  package_label?: string | null;
  is_active?: boolean;
  provider?: string | null;
  provider_product_id?: string | null;
  provider_item_id?: string | null;
  upc?: string | null;
  brand?: string | null;
};
export type StoreLocation = {
  id: string;
  store_id: string;
  name: string;
  country_code: "US" | "CA";
  currency: Currency;
  is_demo: boolean;
  provider?: string | null;
  provider_location_id?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};
export type StoreOffer = {
  id: string;
  product: RetailProduct;
  location: StoreLocation;
  price: number;
  currency: Currency;
  observed_at: string;
  provider: string;
  is_demo: boolean;
  promotion: string | null;
  retrieved_at?: string | null;
  environment?: string;
  regular_price?: number | null;
  promo_price?: number | null;
  availability?: string;
  price_status?: string;
};
export type PriceObservation = {
  id: string;
  offer_id: string;
  price: number;
  currency: Currency;
  observed_at: string;
};
export type Deal = {
  id: string;
  offer_id: string;
  description: string;
  starts_at: string;
  ends_at: string;
};
export interface PriceProvider {
  readonly name: string;
  readonly isDemo: boolean;
  searchProducts(query: string): Promise<RetailProduct[]>;
  getProductPrice(
    productId: string,
    locationId: string,
  ): Promise<StoreOffer | null>;
  getOffers(foodIds: string[], currency: Currency): Promise<StoreOffer[]>;
  getDeals(locationId: string): Promise<Deal[]>;
  getPriceHistory(offerId: string): Promise<PriceObservation[]>;
}
