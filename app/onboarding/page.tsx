import { requireProfile } from "@/lib/services/auth";
import { OnboardingWizard } from "@/components/onboarding/wizard";
export default async function Onboarding() {
  const { client, profile } = await requireProfile(false);
  const { data: stores, error } = await client
    .from("stores")
    .select("id,name")
    .order("name");
  if (error) throw new Error("Could not load stores.");
  return (
    <OnboardingWizard
      draft={profile.onboarding_draft}
      initialStep={profile.onboarding_step}
      complete={Boolean(profile.onboarding_completed_at)}
      stores={stores || []}
    />
  );
}
