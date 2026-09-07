export interface TravelProvider {
  distances(
    postalCode: string,
    locations: { id: string; postalCode?: string }[],
  ): Promise<Record<string, number | null>>;
}
// No routing provider is configured. Unknown is not a zero-distance assertion.
export const unavailableTravel: TravelProvider = {
  distances: async (_postalCode, locations) =>
    Object.fromEntries(locations.map((l) => [l.id, null])),
};
