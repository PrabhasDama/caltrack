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
const unavailable = {
  status: "unavailable",
  candidate: null,
  message:
    "Automatic extraction is not configured. Review the image and enter the details below. Nothing has been extracted or saved.",
} as const;
// A configured provider can replace these adapters without changing confirmation logic.
export const labelProvider: NutritionLabelExtractionProvider = {
  extract: async () => unavailable,
};
export const receiptProvider: ReceiptExtractionProvider = {
  extract: async () => unavailable,
};
