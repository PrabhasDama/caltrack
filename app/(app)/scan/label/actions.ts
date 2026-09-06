"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/services/auth";
import { normalizeReviewedLabel } from "@/lib/scanning/review";
import { labelProvider } from "@/lib/scanning/providers";
export async function extractLabel(upload: string) {
  z.string().uuid().parse(upload);
  const { client, user } = await requireProfile();
  const { data: row } = await client
    .from("user_uploads")
    .select("path")
    .eq("id", upload)
    .eq("user_id", user.id)
    .eq("bucket", "nutrition-labels")
    .eq("status", "ready")
    .single();
  if (!row) throw new Error("Label image not found.");
  const { data, error } = await client.storage
    .from("nutrition-labels")
    .download(row.path);
  if (error || !data)
    throw new Error("Label image could not be loaded. Please retry.");
  return labelProvider.extract(data);
}
export async function saveReviewedLabel(upload: string, input: unknown) {
  try {
    z.string().uuid().parse(upload);
    const d = normalizeReviewedLabel(input);
    const { client } = await requireProfile();
    const { data, error } = await client.rpc("save_reviewed_label", {
      p_upload: upload,
      p_review: d,
      p_confirmed: d.confirmed,
    });
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { success: true, foodId: data as string };
  } catch (e) {
    return {
      error:
        e instanceof z.ZodError
          ? "Complete the required fields and confirm your review."
          : e instanceof Error
            ? e.message
            : "Could not save the reviewed label.",
    };
  }
}
