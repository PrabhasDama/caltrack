import "server-only";
import { KrogerProvider } from "./kroger";
export const kroger = new KrogerProvider({
  clientId: process.env.KROGER_CLIENT_ID,
  clientSecret: process.env.KROGER_CLIENT_SECRET,
  environment:
    process.env.KROGER_ENVIRONMENT === "production"
      ? "production"
      : "certification",
  diagnostic: (event) =>
    console.info(JSON.stringify({ event: "provider", ...event })),
});
// No Google content is persisted and no invented endpoint is called when credentials are absent.
export const otherProviderStatus = {
  google:
    "Map display requires a restricted Google Maps key. Non-Kroger discovery is not configured.",
  openPrices:
    "Not connected. Licensing and location identity need review before combining Open Prices with first-party data.",
};
