"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/services/auth";
import { dateSchema, localDate } from "@/lib/date";
import { measurementNames, measurementToCm } from "@/lib/progress/analytics";
const amount = z.number().positive().nullable();
const schema = z.object({
  id: z.string().uuid(),
  updated_at: z.string().optional(),
  local_date: dateSchema,
  waist: amount,
  chest: amount,
  hips: amount,
  arms: amount,
  thighs: amount,
  notes: z.string().max(1000),
});
export async function saveMeasurement(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Enter a date and valid measurements." };
  const { client, user, profile } = await requireProfile();
  const d = parsed.data;
  if (d.local_date > localDate(profile.timezone) || d.local_date < "1900-01-01")
    return { error: "Choose a past date or today." };
  const values = Object.fromEntries(
    measurementNames.map((k) => [
      k,
      d[k] === null ? null : measurementToCm(d[k], profile.units),
    ]),
  );
  if (
    !Object.values(values).some((v) => v !== null) ||
    Object.values(values).some((v) => v !== null && (v < 1 || v > 400))
  )
    return {
      error: "Add at least one measurement between 1 and 400 cm (0.4–157 in).",
    };
  const row = {
    id: d.id,
    user_id: user.id,
    local_date: d.local_date,
    notes: d.notes,
    ...values,
  };
  const result = d.updated_at
    ? await client
        .from("body_measurements")
        .update(row)
        .eq("id", d.id)
        .eq("user_id", user.id)
        .eq("updated_at", d.updated_at)
        .select("id")
    : await client.from("body_measurements").insert(row).select("id");
  if (result.error || !result.data?.length)
    return {
      error:
        "This date already has a measurement, or this record changed. Refresh and edit the saved entry.",
    };
  revalidatePath("/progress");
  return { success: true };
}
export async function deleteMeasurement(id: string) {
  if (!z.string().uuid().safeParse(id).success)
    return { error: "Invalid measurement." };
  const { client, user } = await requireProfile();
  const { error } = await client
    .from("body_measurements")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not remove the measurement." };
  revalidatePath("/progress");
  return { success: true };
}
