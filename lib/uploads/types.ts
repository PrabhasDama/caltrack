export type UploadKind = "progress-photos" | "receipts" | "nutrition-labels";
export type UserUpload = {
  id: string;
  bucket: UploadKind;
  path: string;
  local_date: string;
  note: string;
  pose: "front" | "side" | "back" | "custom";
  status: "pending" | "ready";
};
export const uploadMime = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export const maxUploadBytes = 6 * 1024 * 1024;
