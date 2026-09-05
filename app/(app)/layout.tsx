import { requireProfile } from "@/lib/services/auth";
import { AppShell } from "@/components/layout/app-shell";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();
  return <AppShell name={profile.first_name}>{children}</AppShell>;
}
