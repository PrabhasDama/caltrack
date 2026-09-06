import { getPrep } from "@/lib/services/prep";
import { PrepWorkspace } from "@/components/prep/prep-workspace";
export const metadata = { title: "Meal prep" };
export default async function Prep() {
  return <PrepWorkspace {...await getPrep()} />;
}
