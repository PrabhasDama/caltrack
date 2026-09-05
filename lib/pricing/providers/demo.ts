import type {
  PriceProvider,
  StoreOffer,
  PriceObservation,
  Deal,
  Currency,
} from "../types";
export class DemoPriceProvider implements PriceProvider {
  readonly name = "Demo pricing";
  readonly isDemo = true;
  constructor(
    private readonly offers: StoreOffer[],
    private readonly history: PriceObservation[] = [],
    private readonly deals: Deal[] = [],
  ) {
    if (offers.some((o) => !o.is_demo || o.provider !== "demo"))
      throw new Error("The demo provider accepts only simulated offers.");
  }
  async searchProducts(query: string) {
    return [
      ...new Map(
        this.offers
          .filter((o) =>
            o.product.name.toLowerCase().includes(query.toLowerCase()),
          )
          .map((o) => [o.product.id, o.product]),
      ).values(),
    ];
  }
  async getProductPrice(productId: string, locationId: string) {
    return (
      this.offers
        .filter(
          (o) => o.product.id === productId && o.location.id === locationId,
        )
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0] || null
    );
  }
  async getOffers(foodIds: string[], currency: Currency) {
    return this.offers.filter(
      (o) =>
        o.currency === currency &&
        o.product.food_id &&
        foodIds.includes(o.product.food_id),
    );
  }
  async getDeals(locationId: string) {
    const ids = this.offers
      .filter((o) => o.location.id === locationId)
      .map((o) => o.id);
    return this.deals.filter((d) => ids.includes(d.offer_id));
  }
  async getPriceHistory(offerId: string) {
    return this.history
      .filter((h) => h.offer_id === offerId)
      .sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  }
}
