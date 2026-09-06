import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
export async function proxy(request: NextRequest) {
  return updateSession(request);
}
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/pantry/:path*",
    "/groceries/:path*",
    "/budget/:path*",
    "/preferences/:path*",
    "/onboarding/:path*",
    "/plan/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/progress/:path*",
    "/more/:path*",
    "/reset-password",
  ],
};
