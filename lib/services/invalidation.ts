import "server-only";
import { revalidatePath } from "next/cache";
export function invalidate(
  domain: "inventory" | "purchase" | "plan" | "tracking" | "budget",
) {
  const paths = {
    inventory: ["/pantry", "/groceries", "/plan", "/prep", "/dashboard"],
    purchase: [
      "/budget",
      "/groceries",
      "/pantry",
      "/plan",
      "/prep",
      "/dashboard",
      "/progress",
    ],
    plan: ["/plan", "/groceries", "/prep", "/dashboard", "/progress"],
    tracking: [
      "/dashboard",
      "/progress",
      "/plan",
      "/groceries",
      "/pantry",
      "/prep",
    ],
    budget: ["/budget", "/plan", "/groceries", "/progress"],
  };
  for (const path of paths[domain]) revalidatePath(path);
}
