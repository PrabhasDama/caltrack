"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/services/auth";
import { receiptProvider } from "@/lib/scanning/providers";
import { receiptReview } from "@/lib/scanning/receipt";
export async function extractReceipt(id: string) {
  z.string().uuid().parse(id);
  const { client, user } = await requireProfile();
  const { data: row } = await client
    .from("user_uploads")
    .select("path")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("bucket", "receipts")
    .eq("status", "ready")
    .single();
  if (!row) throw new Error("Receipt image not found");
  const saved = await client
    .from("purchases")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (saved.data) return { saved: true } as const;
  const { data, error } = await client.storage
    .from("receipts")
    .download(row.path);
  if (error || !data) throw new Error("Could not load receipt image");
  return {
    saved: false,
    extraction: await receiptProvider.extract(data),
  } as const;
}
export async function confirmReceipt(id: string, input: unknown) {
  const parsed = receiptReview.safeParse(input);
  if (!parsed.success || !z.string().uuid().safeParse(id).success)
    return {
      error:
        "Review all fields, match the line totals, and confirm before saving.",
    };
  const { client } = await requireProfile();
  const { error } = await client.rpc("confirm_reviewed_receipt", {
    p_upload: id,
    p_review: parsed.data,
    p_confirmed: parsed.data.confirmed,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { success: true };
}
