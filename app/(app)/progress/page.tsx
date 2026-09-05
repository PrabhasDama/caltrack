import { getDashboard } from "@/lib/services/dashboard";
import { ProgressView } from "@/components/dashboard/progress-view";
export const metadata = { title: "Your progress" };
export default async function Progress() {
  return <ProgressView data={await getDashboard()} />;
}
