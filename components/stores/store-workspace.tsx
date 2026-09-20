"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/dashboard/use-mutation";
import {
  discoverStores,
  setLocationPreference,
  saveStoreSettings,
  searchStoreProducts,
  confirmStoreProduct,
} from "@/app/(app)/stores/actions";
import type { getStoresData } from "@/lib/services/stores";
import type { ProviderProduct, ProviderStore } from "@/lib/providers/types";
import { PriceDisplay } from "@/components/groceries/price-display";
import { unitPrices, money } from "@/lib/pricing/calculations";
import { StoreMap } from "./store-map";
type Data = Awaited<ReturnType<typeof getStoresData>>;
export function StoreWorkspace({
  data,
  mapKey,
  mapId,
  configured,
  environment,
}: {
  data: Data;
  mapKey: string;
  mapId: string;
  configured: boolean;
  environment: string;
}) {
  const [postal, setPostal] = useState(data.settings.postal_code),
    [radius, setRadius] = useState(data.settings.radius_miles),
    [share, setShare] = useState(data.settings.share_prices),
    [found, setFound] = useState<(ProviderStore & { id: string })[] | null>(
      null,
    ),
    [active, setActive] = useState(""),
    [view, setView] = useState("list"),
    [term, setTerm] = useState(""),
    [products, setProducts] = useState<(ProviderProduct & { id: string })[]>(
      [],
    ),
    [message, setMessage] = useState("");
  const { pending, error, run } = useMutation();
  const locations = useMemo(
    () =>
      found
        ? found.map((s) => ({
            id: s.id,
            name: s.name,
            address: s.address,
            latitude: s.coordinates?.latitude ?? null,
            longitude: s.coordinates?.longitude ?? null,
            distance: s.distanceMiles,
            kind: s.distanceKind,
          }))
        : data.locations
            .filter((l) => data.preferences.some((p) => p.location_id === l.id))
            .map((l) => ({ ...l, distance: null, kind: "unknown" })),
    [found, data.locations, data.preferences],
  );
  const points = useMemo(
    () =>
      locations.map((l) => ({
        id: l.id,
        name: l.name,
        latitude: l.latitude,
        longitude: l.longitude,
      })),
    [locations],
  );
  const search = (origin?: { latitude: number; longitude: number }) =>
    run(async () => {
      const r = await discoverStores({
        postalCode: postal,
        radiusMiles: radius,
        origin,
      });
      if (r.error) return r;
      if (r.stores) {
        setFound(r.stores);
        setActive("");
        setProducts([]);
        setMessage(
          r.stores.length
            ? `${r.stores.length} locations returned by Kroger. Select a store to browse products.`
            : "No Kroger-family stores found in this area.",
        );
      }
      return { success: true };
    });
  const selected = locations.find((l) => l.id === active);
  const productSearch = (product?: string, refresh = false) =>
    run(async () => {
      const r = await searchStoreProducts({
        location: active,
        term: term || "product",
        product,
        refresh,
      });
      if (r.error) return r;
      if (r.products) {
        setProducts(r.products);
        setMessage(
          `${r.products.length} product packages returned. Check the exact food and size before linking.`,
        );
      }
      return { success: true };
    });
  return (
    <div className="secondary-page">
      <header className="page-title">
        <span className="eyebrow">YOUR REAL STORES</span>
        <h1>
          Nearby stores<span className="brand-dot">.</span>
        </h1>
        <p>
          Choose actual locations for your grocery comparisons.{" "}
          <Link href="/groceries">Back to groceries</Link>
        </p>
      </header>
      {!configured && (
        <p className="notice">
          Kroger is not configured. Your saved shopping and manual price entry
          still work.
        </p>
      )}
      {environment === "certification" && (
        <p className="notice">
          Kroger Certification environment. Catalog prices, when supplied, need
          confirmation and are excluded from price optimization. Confirmed
          purchases can supply your own price history.
        </p>
      )}
      <section className="card">
        <form
          className="store-search"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <label className="field">
            ZIP / postal code
            <input
              value={postal}
              onChange={(e) => setPostal(e.target.value)}
              maxLength={12}
              autoComplete="postal-code"
            />
          </label>
          <label className="field">
            Search radius (miles)
            <input
              type="number"
              min="1"
              max="50"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
          </label>
          <Button disabled={pending} type="submit">
            {pending ? "Working…" : "Find nearby stores"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (!navigator.geolocation) {
                setMessage(
                  "Location is unavailable. Enter a ZIP code instead.",
                );
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (p) =>
                  search({
                    latitude: p.coords.latitude,
                    longitude: p.coords.longitude,
                  }),
                () =>
                  setMessage(
                    "Location access was denied or unavailable. ZIP search still works.",
                  ),
                {
                  enableHighAccuracy: false,
                  timeout: 10000,
                  maximumAge: 300000,
                },
              );
            }}
          >
            Use my location
          </Button>
        </form>
        <p className="fine-print">
          Kroger currently supports US ZIP searches. Precise location is
          optional, requested only by the button, and is not saved. Distances
          from device location are straight-line distances, not driving routes.
        </p>
        <label className="store-sharing">
          <input
            type="checkbox"
            checked={share}
            onChange={(e) => setShare(e.target.checked)}
          />{" "}
          Share future confirmed package prices with other users
        </label>
        <p className="fine-print">
          Only product, location, price, package weight and purchase date are
          shared. Identity, images and payment details stay private. Turning
          this off removes your shared observations. This does not share past
          purchases automatically.
        </p>
        <Button
          disabled={pending}
          variant="outline"
          onClick={() =>
            run(
              () => saveStoreSettings({ postal, radius, share }),
              () => setMessage("Search area and sharing preference saved."),
            )
          }
        >
          Save store settings
        </Button>
      </section>
      <div className="store-view-switch">
        <Button
          variant={view === "list" ? "default" : "outline"}
          onClick={() => setView("list")}
        >
          List
        </Button>
        <Button
          variant={view === "map" ? "default" : "outline"}
          onClick={() => setView("map")}
        >
          Map and list
        </Button>
      </div>
      {view === "map" && (
        <StoreMap
          apiKey={mapKey}
          mapId={mapId}
          points={points}
          active={active}
          onSelect={setActive}
        />
      )}
      <div className="store-results">
        {locations.map((l) => {
          const pref = data.preferences.find(
            (p) => p.location_id === l.id,
          )?.state;
          return (
            <article
              key={l.id}
              className={`card store-result ${active === l.id ? "active" : ""}`}
            >
              <button
                className="store-title"
                aria-pressed={active === l.id}
                onClick={() => {
                  setActive(l.id);
                  setProducts([]);
                }}
              >
                {l.name}
              </button>
              <p>{l.address}</p>
              <p className="fine-print">
                {l.distance !== null
                  ? `${l.distance.toFixed(1)} mi · straight-line distance`
                  : "Distance not supplied · search radius is approximate"}
              </p>
              <p>
                {pref === "selected"
                  ? "Preferred location"
                  : pref === "excluded"
                    ? "Excluded from comparisons"
                    : "Not selected"}
              </p>
              <div className="purchase-actions">
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      setLocationPreference({
                        location: l.id,
                        state: pref === "selected" ? "none" : "selected",
                      }),
                    )
                  }
                >
                  {pref === "selected"
                    ? "Remove preference"
                    : "Prefer this location"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      setLocationPreference({
                        location: l.id,
                        state: pref === "excluded" ? "none" : "excluded",
                      }),
                    )
                  }
                >
                  {pref === "excluded" ? "Clear exclusion" : "Exclude"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {!locations.length && (
        <p className="card">
          Search your area to find real Kroger-family stores. Other retailers
          need a configured location provider.
        </p>
      )}
      {selected && (
        <section className="card">
          <h2>Products at {selected.name}</h2>
          <form
            className="store-search"
            onSubmit={(e) => {
              e.preventDefault();
              productSearch();
            }}
          >
            <label className="field">
              Search store products
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                minLength={2}
                maxLength={100}
                placeholder="Plain Greek yogurt"
              />
            </label>
            <Button disabled={pending}>Search products</Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending || term.length < 2}
              onClick={() => productSearch(undefined, true)}
            >
              Refresh prices
            </Button>
          </form>
          <p className="fine-print">
            Each search is limited to 12 product results. No automatic
            background searches run when you change tabs.
          </p>
        </section>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="store-results">
        {products.map((p) => (
          <article
            className="card"
            key={`${p.providerProductId}:${p.providerItemId}`}
          >
            <h3>{p.description}</h3>
            <p>
              {p.brand} · {p.packageSize || "Package size unknown"}
            </p>
            <PriceDisplay
              value={{
                price: p.effectivePrice,
                currency: p.currency,
                source: "provider",
                observedAt: p.retrievedAt,
                environment: p.environment,
                regularPrice: p.regularPrice,
              }}
            />
            <p>Availability: {p.availability.replaceAll("_", " ")}</p>
            <p className="fine-print">
              Kroger · UPC {p.upc || "unavailable"} · product{" "}
              {p.providerProductId}
            </p>
            {p.effectivePrice !== null && p.packageGrams && (
              <p>
                {money(
                  unitPrices(p.effectivePrice, p.packageGrams)!.per100g,
                  p.currency,
                )}{" "}
                / 100 g
              </p>
            )}
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => productSearch(p.providerProductId)}
            >
              Full product details
            </Button>
            <details>
              <summary>Review food match for my groceries</summary>
              <p className="fine-print">
                Confirm the exact food and whole package weight. This mapping
                applies only to your account. No substitute is chosen
                automatically.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  run(
                    () =>
                      confirmStoreProduct({
                        product: p.id,
                        food: f.get("food"),
                        grams: Number(f.get("grams")),
                      }),
                    () =>
                      setMessage(
                        "Food match saved. You can purchase this package from Groceries.",
                      ),
                  );
                }}
              >
                <label className="field">
                  Matching food
                  <select name="food" required defaultValue="">
                    <option value="">Choose the exact food</option>
                    {data.foods.map((f) => (
                      <option value={f.id} key={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Whole package weight (g)
                  <input
                    name="grams"
                    type="number"
                    required
                    min="0.001"
                    max="1000000"
                    step="0.001"
                    defaultValue={p.packageGrams ?? ""}
                    readOnly={p.packageGrams !== null}
                  />
                </label>
                <Button disabled={pending || !p.id}>
                  Confirm food and package
                </Button>
              </form>
            </details>
          </article>
        ))}
      </div>
      <p className="fine-print">
        Open Prices and other retailer price sources are not connected. No demo
        prices are substituted for missing provider data.
      </p>
    </div>
  );
}
