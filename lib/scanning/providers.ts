export type ExtractionResult<T> =
  | { status: "extracted"; candidate: T; provider: string }
  | { status: "unavailable"; candidate: null; message: string };
export type LabelCandidate = Partial<
  Record<
    | "name"
    | "servingSize"
    | "servingUnit"
    | "servingGrams"
    | "servingsPerContainer"
    | "calories"
    | "protein"
    | "carbs"
    | "fat"
    | "fiber"
    | "sugar"
    | "sodium",
    string | number | null
  >
>;
export type ReceiptCandidate = {
  store?: string;
  date?: string;
  total?: number;
  items: { name: string; quantity?: number; price?: number }[];
};
export interface NutritionLabelExtractionProvider {
  extract(image: Blob): Promise<ExtractionResult<LabelCandidate>>;
}
export interface ReceiptExtractionProvider {
  extract(image: Blob): Promise<ExtractionResult<ReceiptCandidate>>;
}
import { z } from "zod";
const unavailable = {
  status: "unavailable",
  candidate: null,
  message:
    "Automatic extraction is not configured. Review the image and enter the details below. Nothing has been extracted or saved.",
} as const;
// Server-only configuration, passed lazily so unconfigured builds need no provider.
// Transport contract: POST raw image; response fields carry value + confidence.
const field = z.object({
  value: z.union([z.string().max(120), z.number().finite(), z.null()]),
  confidence: z.number().min(0).max(1),
});
const fields = z.record(z.string(), field);
const envelope = z.object({
  fields: fields.optional(),
  items: z.array(fields).max(100).optional(),
});
export async function extractWithGateway(
  kind: "label" | "receipt",
  image: Blob,
  config: { url?: string; token?: string },
  send: typeof fetch = fetch,
): Promise<ExtractionResult<LabelCandidate | ReceiptCandidate>> {
  if (!config.url || !config.token) return unavailable;
  try {
    if (new URL(config.url).protocol !== "https:")
      throw new Error("HTTPS required");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(image.type) ||
      image.size > 6 * 1024 * 1024 ||
      !image.size
    )
      throw new Error("Invalid image");
    const r = await send(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": image.type,
        "X-Extraction-Kind": kind,
      },
      body: image,
      signal: AbortSignal.timeout(20000),
      redirect: "error",
      cache: "no-store",
    });
    if (!r.ok || !r.body) throw new Error("Provider unavailable");
    const reader = r.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 128000) {
        await reader.cancel();
        throw new Error("Response too large");
      }
      chunks.push(value);
    }
    const payload = envelope.parse(
      JSON.parse(await new Blob(chunks as BlobPart[]).text()),
    );
    const clean = (values: z.infer<typeof fields> = {}) =>
      Object.fromEntries(
        Object.entries(values).map(([k, v]) => [
          k,
          v.confidence >= 0.85 ? v.value : null,
        ]),
      );
    const raw = clean(payload.fields);
    const labelKeys = [
      "name",
      "servingSize",
      "servingUnit",
      "servingGrams",
      "servingsPerContainer",
      "calories",
      "protein",
      "carbs",
      "fat",
      "fiber",
      "sugar",
      "sodium",
    ];
    const candidate =
      kind === "label"
        ? Object.fromEntries(labelKeys.map((k) => [k, raw[k] ?? null]))
        : {
            store: typeof raw.store === "string" ? raw.store : undefined,
            date: typeof raw.date === "string" ? raw.date : undefined,
            total: typeof raw.total === "number" ? raw.total : undefined,
            items: (payload.items || []).map((i) => {
              const v = clean(i);
              return {
                name: typeof v.name === "string" ? v.name : "",
                quantity:
                  typeof v.quantity === "number" ? v.quantity : undefined,
                price: typeof v.price === "number" ? v.price : undefined,
              };
            }),
          };
    return {
      status: "extracted",
      candidate,
      provider: "configured extraction service",
    };
  } catch {
    return {
      status: "unavailable",
      candidate: null,
      message:
        "Automatic extraction could not read this image. You can enter every field manually or try another image. Nothing has been saved.",
    };
  }
}
function config() {
  return {
    url: process.env.EXTRACTION_SERVICE_URL,
    token: process.env.EXTRACTION_SERVICE_TOKEN,
  };
}
export const labelProvider: NutritionLabelExtractionProvider = {
  extract: async (image) =>
    (await extractWithGateway(
      "label",
      image,
      config(),
    )) as ExtractionResult<LabelCandidate>,
};
export const receiptProvider: ReceiptExtractionProvider = {
  extract: async (image) =>
    (await extractWithGateway(
      "receipt",
      image,
      config(),
    )) as ExtractionResult<ReceiptCandidate>,
};
