"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { appUrl, isConfigured } from "@/lib/supabase/config";
import { authSchema, emailSchema, passwordSchema } from "@/lib/validation/auth";
export type AuthState = { error?: string; success?: string };
export async function authAction(
  mode: "login" | "signup" | "forgot" | "reset",
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!isConfigured())
    return {
      error: "Account access will be ready once Supabase is connected.",
    };
  const client = await createClient();
  try {
    if (mode === "forgot") {
      const parsed = emailSchema.safeParse(form.get("email"));
      if (!parsed.success) return { error: parsed.error.issues[0].message };
      const { error } = await client.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${appUrl()}/auth/callback?next=/reset-password`,
      });
      if (error)
        return {
          error:
            "Unable to send a reset email right now. Please wait a moment and try again.",
        };
      return {
        success:
          "If an account exists for that address, a password reset link is on its way. Check your inbox.",
      };
    }
    if (mode === "reset") {
      const parsed = passwordSchema.safeParse(form.get("password"));
      if (!parsed.success) return { error: parsed.error.issues[0].message };
      const { data } = await client.auth.getUser();
      if (!data.user)
        return { error: "This reset link has expired. Request a new one." };
      const { error } = await client.auth.updateUser({ password: parsed.data });
      if (error)
        return {
          error:
            "The password could not be updated. Use a different password or request a new reset link.",
        };
      await client.auth.signOut();
      return { success: "Your password is updated. You can now log in." };
    }
    const parsed = authSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    if (mode === "signup") {
      const { data, error } = await client.auth.signUp({
        ...parsed.data,
        options: { emailRedirectTo: `${appUrl()}/auth/callback` },
      });
      if (error)
        return {
          error:
            "We couldn’t create your account. Please check your details and try again in a moment.",
        };
      if (!data.session)
        return {
          success:
            "Check your email to confirm your account, then we’ll set up your plan. If you already have an account, log in.",
        };
    } else {
      const { error } = await client.auth.signInWithPassword(parsed.data);
      if (error)
        return {
          error:
            "Unable to log in. Check your email and password, and confirm your email if you just signed up.",
        };
    }
  } catch {
    return {
      error: "We couldn’t reach the account service. Please try again.",
    };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
export async function logout() {
  const client = await createClient();
  const { error } = await client.auth.signOut();
  if (error) throw new Error("Could not log out. Please retry.");
  revalidatePath("/", "layout");
  redirect("/login");
}
