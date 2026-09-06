"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/services/auth";
import { sectionSchemas, type Section } from "@/lib/preferences/sections";
import { macroWarnings } from "@/lib/nutrition/macros";
export async function savePreferences(input: unknown) {
  const p = z
    .object({
      section: z.string(),
      data: z.record(z.string(), z.unknown()),
      expected: z.record(z.string(), z.unknown()),
      acknowledged: z.boolean().optional(),
    })
    .safeParse(input);
  if (!p.success || !Object.hasOwn(sectionSchemas, p.data.section))
    return { error: "Invalid preferences" };
  const section = p.data.section as Section;
  const parsed = sectionSchemas[section].safeParse(p.data.data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (section === "macros") {
    const m = sectionSchemas.macros.parse(parsed.data);
    if (macroWarnings(m).length && !p.data.acknowledged)
      return { error: "Please acknowledge the target warnings before saving." };
  }
  const { client } = await requireProfile();
  const { error } = await client.rpc("save_preference_section", {
    p_section: section,
    p_data: parsed.data,
    p_expected: p.data.expected,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { success: true };
}
