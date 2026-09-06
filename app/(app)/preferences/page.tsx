import { getPreferences } from "@/lib/services/preferences";
import { PreferencesWorkspace } from "@/components/preferences/preferences-workspace";
export const metadata = { title: "Your preferences" };
export default async function Preferences() {
  const d = await getPreferences();
  return <PreferencesWorkspace {...d} />;
}
