import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return new Response(null, { status: 404 });
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return new Response(null, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  const { data: row } = await client
    .from("user_uploads")
    .select("bucket,path")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "ready")
    .maybeSingle();
  if (!row) return new Response(null, { status: 404 });
  const { data, error } = await client.storage
    .from(row.bucket)
    .download(row.path);
  if (error || !data) return new Response(null, { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": data.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
