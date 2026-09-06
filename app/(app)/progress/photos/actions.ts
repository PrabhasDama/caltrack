"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/services/auth";
import { dateSchema, localDate } from "@/lib/date";
import { uploadMime } from "@/lib/uploads/types";
export async function reserveUpload(input: unknown) {
  const p = z
    .object({
      id: z.string().uuid(),
      bucket: z.enum(["progress-photos", "receipts", "nutrition-labels"]),
      mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
      date: dateSchema,
      note: z.string().max(1000),
      pose: z.enum(["front", "side", "back", "custom"]),
    })
    .safeParse(input);
  if (!p.success)
    return { error: "Choose a JPEG, PNG or WebP image and valid details." };
  const { client, user, profile } = await requireProfile();
  const d = p.data;
  if (d.date > localDate(profile.timezone) || d.date < "1900-01-01")
    return { error: "Choose a past date or today." };
  const path = `${user.id}/${d.id}.${uploadMime[d.mime]}`;
  const existing = await client
    .from("user_uploads")
    .select("id,path,bucket,status")
    .eq("id", d.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing.error) return { error: "Could not prepare your upload." };
  if (existing.data) {
    if (existing.data.path !== path || existing.data.bucket !== d.bucket)
      return { error: "Select the image again to start a new upload." };
    return { id: d.id, path, ready: existing.data.status === "ready" };
  }
  const { error } = await client
    .from("user_uploads")
    .insert({
      id: d.id,
      user_id: user.id,
      bucket: d.bucket,
      path,
      local_date: d.date,
      note: d.note,
      pose: d.pose,
    });
  return error
    ? { error: "Could not prepare your upload. Please retry." }
    : { id: d.id, path, ready: false };
}
export async function finishUpload(id: string) {
  if (!z.string().uuid().safeParse(id).success)
    return { error: "Invalid upload." };
  const { client, user } = await requireProfile();
  const { data: row, error } = await client
    .from("user_uploads")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error || !row) return { error: "Upload not found." };
  const files = await client.storage
    .from(row.bucket)
    .list(user.id, { search: row.path.split("/")[1] });
  if (
    files.error ||
    !files.data.some((f) => `${user.id}/${f.name}` === row.path)
  )
    return { error: "The image has not finished uploading. Please retry." };
  const saved = await client
    .from("user_uploads")
    .update({ status: "ready" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (saved.error)
    return { error: "Could not finish saving the image. Please retry." };
  revalidatePath("/", "layout");
  return { success: true };
}
export async function deleteUpload(id: string) {
  if (!z.string().uuid().safeParse(id).success)
    return { error: "Invalid upload." };
  const { client, user } = await requireProfile();
  const { data: row, error } = await client
    .from("user_uploads")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { error: "Could not load the image." };
  if (!row) return { success: true };
  const removed = await client.storage.from(row.bucket).remove([row.path]);
  if (removed.error)
    return { error: "Could not remove the stored image. Please retry." };
  const saved = await client
    .from("user_uploads")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (saved.error)
    return { error: "Could not remove the image details. Please retry." };
  revalidatePath("/", "layout");
  return { success: true };
}
