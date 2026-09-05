import { z } from "zod";
export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(254);
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use no more than 128 characters.");
export const authSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export function safeNext(value: string | null) {
  return value === "/reset-password" ? value : "/dashboard";
}
