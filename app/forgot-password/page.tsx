import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { isConfigured } from "@/lib/supabase/config";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthShell>
      <AuthForm
        mode="forgot"
        configured={isConfigured()}
        initialError={
          error === "link"
            ? "That email link has expired or was already used. Please request a new link."
            : undefined
        }
      />
    </AuthShell>
  );
}
