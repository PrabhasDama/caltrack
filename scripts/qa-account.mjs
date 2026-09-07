// Creates an isolated test account without sending email. Secrets stay in memory.
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ref = new URL(url).hostname.split(".")[0];
const raw = execFileSync(
  "supabase",
  [
    "projects",
    "api-keys",
    "--project-ref",
    ref,
    "--reveal",
    "--output",
    "json",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
const parsed = JSON.parse(raw);
const keys = Array.isArray(parsed)
  ? parsed
  : parsed.api_keys || parsed.keys || [];
const key =
  keys.find((k) => k.name === "service_role") ||
  keys.find((k) => k.type === "secret");
if (!key) throw new Error("No administrative key available for isolated QA.");
const admin = createClient(url, key.api_key || key.key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const file = process.env.QA_ACCOUNT_FILE || ".env.qa";
if (!/^\.env\.qa(?:-[a-z]+)?$/.test(file))
  throw new Error("Invalid QA filename");
if (process.argv.includes("--cleanup")) {
  if (existsSync(file)) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    for (const bucket of ["progress-photos", "receipts", "nutrition-labels"]) {
      for (;;) {
        const listed = await admin.storage
          .from(bucket)
          .list(data.id, { limit: 100 });
        if (listed.error) throw listed.error;
        if (!listed.data.length) break;
        const removed = await admin.storage
          .from(bucket)
          .remove(listed.data.map((f) => `${data.id}/${f.name}`));
        if (removed.error) throw removed.error;
      }
    }
    const { error } = await admin.auth.admin.deleteUser(data.id);
    if (error) throw error;
    unlinkSync(file);
    console.log("Isolated QA account, private files, and records removed.");
  }
} else {
  if (existsSync(file))
    throw new Error("QA account exists; reuse it or clean it up first.");
  const email = `caltrack-qa-${randomUUID()}@example.invalid`;
  const password = randomUUID() + randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { purpose: "CalTrack automated QA" },
  });
  if (error) throw error;
  writeFileSync(file, JSON.stringify({ id: data.user.id, email, password }), {
    mode: 0o600,
  });
  console.log("Isolated QA account ready. No email sent.");
}
