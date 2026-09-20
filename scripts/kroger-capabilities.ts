// Bounded read-only diagnostic. Only normalized public catalog fields are saved; no credentials/tokens.
import { writeFileSync, mkdirSync } from "node:fs";
import { KrogerProvider } from "../lib/providers/kroger";
process.loadEnvFile(".env.local");
async function main() {
  const provider = new KrogerProvider({
    clientId: process.env.KROGER_CLIENT_ID,
    clientSecret: process.env.KROGER_CLIENT_SECRET,
    environment:
      process.env.KROGER_ENVIRONMENT === "production"
        ? "production"
        : "certification",
  });
  const stores = await provider.getNearbyStores({
    postalCode: "90815",
    radiusMiles: 10,
  });
  if (!stores.ok) throw Error(stores.message);
  const samples = [];
  for (const store of stores.data.slice(0, 2))
    for (const term of ["eggs", "milk", "rice"]) {
      const search = await provider.searchProducts(
        term,
        store.providerLocationId,
      );
      if (!search.ok) {
        samples.push({
          location: store.providerLocationId,
          term,
          error: search.code,
        });
        continue;
      }
      const first = search.data[0];
      if (!first) continue;
      const detail = await provider.getProduct(
        first.providerProductId,
        store.providerLocationId,
      );
      samples.push({
        location: store.providerLocationId,
        term,
        search: first,
        detail: detail.ok ? detail.data : detail,
      });
    }
  const report = {
    checkedAt: new Date().toISOString(),
    environment: provider.environment,
    capabilities: provider.capabilities(),
    note: "Certification fields are observations of the test environment, not verified production store quotes. Prices vary by product; missing is never zero.",
    locations: stores.data
      .slice(0, 2)
      .map((s) => ({ id: s.providerLocationId, name: s.name })),
    samples,
  };
  mkdirSync("docs", { recursive: true });
  writeFileSync(
    "docs/kroger-capabilities.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        environment: report.environment,
        capabilities: report.capabilities,
        samples: samples.map((s) => ({
          location: s.location,
          term: s.term,
          ...("search" in s
            ? {
                product: s.search?.description,
                regular: s.search?.regularPrice,
                promo: s.search?.promoPrice,
                availability: s.search?.availability,
              }
            : { error: s.error }),
        })),
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Diagnostic failed");
  process.exitCode = 1;
});
