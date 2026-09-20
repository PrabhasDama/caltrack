import { priceMeaning, type PriceInput } from "@/lib/pricing/semantics";
import { money } from "@/lib/pricing/calculations";
export function PriceDisplay({ value }: { value: PriceInput }) {
  const p = priceMeaning(value);
  return (
    <span className="price-display">
      <strong>{p.amount}</strong>
      {p.state !== "unavailable" && (
        <>
          {" "}
          · <span>{p.label}</span>
        </>
      )}
      {value.regularPrice != null &&
        value.price != null &&
        value.price < value.regularPrice && (
          <> · Promo, regular {money(value.regularPrice, value.currency)}</>
        )}
      {value.observedAt && (
        <small>
          {" "}
          ·{" "}
          {new Date(value.observedAt).toLocaleString("en-US", {
            timeZone: "UTC",
          })}{" "}
          UTC
        </small>
      )}
    </span>
  );
}
