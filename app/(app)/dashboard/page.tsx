import { getDashboard } from "@/lib/services/dashboard";
import { TodayDashboard } from "@/components/dashboard/today";
export const metadata = { title: "Today" };
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const data = await getDashboard(date);
  return <TodayDashboard data={data} viewingHistory={Boolean(date)} />;
}
