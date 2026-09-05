export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Supabase is not configured. Add the project URL and publishable key to .env.local.",
    );
  return { url, key };
}
export function appUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(value).origin;
}
