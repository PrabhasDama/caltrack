const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
type Identity = {
  upc?: string | null;
  providerProductId?: string;
  provider?: string;
  name: string;
  brand?: string;
  packageGrams?: number | null;
  packageSize?: string;
};
export function productMatch(need: Identity, candidate: Identity) {
  const samePackage =
    need.packageSize && candidate.packageSize
      ? normalize(need.packageSize) === normalize(candidate.packageSize)
      : need.packageGrams != null &&
        candidate.packageGrams === need.packageGrams;
  if (
    need.upc &&
    candidate.upc &&
    need.upc.replace(/^0+/, "") === candidate.upc.replace(/^0+/, "")
  )
    return { confidence: 1, method: "upc", review: false };
  if (
    need.provider &&
    need.provider === candidate.provider &&
    need.providerProductId &&
    need.providerProductId === candidate.providerProductId &&
    samePackage
  )
    return { confidence: 1, method: "provider_id", review: false };
  if (
    samePackage &&
    normalize(need.name) === normalize(candidate.name) &&
    need.brand &&
    candidate.brand &&
    normalize(need.brand) === normalize(candidate.brand)
  )
    return {
      confidence: 0.98,
      method: "exact_brand_product_package",
      review: false,
    };
  const exact = normalize(need.name) === normalize(candidate.name);
  return {
    confidence: exact ? 0.7 : 0.2,
    method: exact ? "name_only" : "uncertain",
    review: true,
  };
}
