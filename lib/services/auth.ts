import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
export async function requireUser() {
  if (!isConfigured()) redirect("/setup");
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { client, user: data.user };
}
export async function requireProfile(complete = true) {
  const { client, user } = await requireUser();
  const { data: profile, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error)
    throw new Error(
      "Your account data could not be loaded. Check that the CalTrack database migration has been applied, then retry.",
    );
  if (complete && !profile.onboarding_completed_at) redirect("/onboarding");
  return { client, user, profile };
}
