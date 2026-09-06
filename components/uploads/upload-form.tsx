"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  reserveUpload,
  finishUpload,
} from "@/app/(app)/progress/photos/actions";
import { Button } from "@/components/ui/button";
import {
  uploadMime,
  maxUploadBytes,
  type UploadKind,
} from "@/lib/uploads/types";
export function UploadForm({
  bucket,
  today,
  onSaved,
}: {
  bucket: UploadKind;
  today: string;
  onSaved: (id: string) => void;
}) {
  const [selectedFile, setFile] = useState<File | null>(null),
    [id, setId] = useState(() => crypto.randomUUID()),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const image = f.get("image");
        const file = image instanceof File && image.size ? image : selectedFile;
        if (!file) return;
        setPending(true);
        setError("");
        try {
          if (!(file.type in uploadMime) || file.size > maxUploadBytes)
            throw new Error("Choose a JPEG, PNG or WebP image up to 6 MB.");
          const prepared = await reserveUpload({
            id,
            bucket,
            mime: file.type,
            date: f.get("date"),
            note: f.get("note") || "",
            pose: f.get("pose") || "custom",
          });
          if (prepared.error || !prepared.path) throw new Error(prepared.error);
          if (!prepared.ready) {
            const client = createClient();
            const result = await client.storage
              .from(bucket)
              .upload(prepared.path, file, {
                contentType: file.type,
                upsert: false,
              });
            if (
              result.error &&
              !(
                "statusCode" in result.error &&
                String(result.error.statusCode) === "409"
              )
            )
              throw new Error(result.error.message);
            const saved = await finishUpload(id);
            if (saved.error) throw new Error(saved.error);
          }
          onSaved(id);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Upload failed. Please retry.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="field">
        Choose image
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setId(crypto.randomUUID());
          }}
        />
      </label>
      <p className="fine-print muted">
        JPEG, PNG or WebP, up to 6 MB. On your phone, choose your camera or
        photo library. Stored privately in your account.
      </p>
      <label className="field">
        Photo date
        <input
          type="date"
          name="date"
          required
          defaultValue={today}
          max={today}
        />
      </label>
      {bucket === "progress-photos" && (
        <>
          <label className="field">
            View
            <select name="pose" defaultValue="front">
              {["front", "side", "back", "custom"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Note (optional)
            <textarea name="note" maxLength={1000} />
          </label>
        </>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <Button disabled={pending}>
        {pending
          ? "Uploading…"
          : bucket === "progress-photos"
            ? "Save photo"
            : "Upload for review"}
      </Button>
    </form>
  );
}
