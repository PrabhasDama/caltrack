import "server-only";
import { requireProfile } from "./auth";
import { allRows } from "./paginate";
import type { UserUpload, UploadKind } from "@/lib/uploads/types";
import { localDate } from "@/lib/date";
export async function getUploads(bucket: UploadKind) {
  const { client, user, profile } = await requireProfile();
  return {
    today: localDate(profile.timezone),
    uploads: await allRows<UserUpload>((a, b) =>
      client
        .from("user_uploads")
        .select("*")
        .eq("user_id", user.id)
        .eq("bucket", bucket)
        .eq("status", "ready")
        .order("local_date", { ascending: false })
        .order("id")
        .range(a, b),
    ),
  };
}
