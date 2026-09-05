import { describe, it, expect } from "vitest";
import { authSchema, safeNext } from "@/lib/validation/auth";
describe("authentication validation", () => {
  it("rejects invalid addresses and short passwords", () => {
    expect(
      authSchema.safeParse({ email: "not-email", password: "abc" }).success,
    ).toBe(false);
  });
  it("allows a valid passphrase", () => {
    expect(
      authSchema.safeParse({
        email: "a@example.com",
        password: "a long safe passphrase",
      }).success,
    ).toBe(true);
  });
  it("never accepts an external or arbitrary redirect", () => {
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext("/reset-password")).toBe("/reset-password");
  });
});
