"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UploadForm } from "@/components/uploads/upload-form";
import { PrivateImage } from "@/components/uploads/private-image";
import { useMutation } from "@/components/dashboard/use-mutation";
import { deleteUpload } from "@/app/(app)/progress/photos/actions";
import type { UserUpload } from "@/lib/uploads/types";
export function PhotoWorkspace({
  uploads,
  today,
}: {
  uploads: UserUpload[];
  today: string;
}) {
  const [open, setOpen] = useState(false),
    [left, setLeft] = useState(uploads.at(-1)?.id || ""),
    [right, setRight] = useState(uploads[0]?.id || ""),
    [remove, setRemove] = useState<string | null>(null);
  const { pending, error, run } = useMutation(),
    router = useRouter();
  const a = uploads.find((p) => p.id === left) || uploads.at(-1),
    b = uploads.find((p) => p.id === right) || uploads[0];
  return (
    <div className="secondary-page">
      <header className="dashboard-heading">
        <div className="page-title">
          <span className="eyebrow">A PRIVATE CHECK-IN</span>
          <h1>Your progress, in pictures.</h1>
          <p>
            Compare your own photos. No body analysis, estimates, or scores.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add progress photo</Button>
          </DialogTrigger>
          <DialogContent
            title="Save a private photo"
            description="Choose a photo, its date, and an optional note."
          >
            {open && (
              <UploadForm
                bucket="progress-photos"
                today={today}
                onSaved={() => {
                  setOpen(false);
                  router.refresh();
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </header>
      {uploads.length >= 2 && (
        <section className="card">
          <h2>Side-by-side comparison</h2>
          <div className="photo-comparison">
            {[
              [a, setLeft, "Earlier photo"],
              [b, setRight, "Later photo"],
            ].map(([photo, set, label]) => {
              const p = photo as UserUpload;
              return (
                <div key={String(label)}>
                  <label className="field">
                    {String(label)}
                    <select
                      value={p.id}
                      onChange={(e) =>
                        (set as (v: string) => void)(e.target.value)
                      }
                    >
                      {uploads.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.local_date} · {u.pose}
                          {u.note ? ` · ${u.note.slice(0, 25)}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <PrivateImage
                    id={p.id}
                    alt={`${p.pose} progress photo from ${p.local_date}`}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}
      {!uploads.length ? (
        <section className="card progress-empty">
          <h2>A space just for you.</h2>
          <p>
            Add a photo whenever it feels useful. Photos are optional and
            private.
          </p>
        </section>
      ) : (
        <section className="photo-grid">
          {uploads.map((p) => (
            <article className="card" key={p.id}>
              <PrivateImage
                id={p.id}
                alt={`${p.pose} progress photo from ${p.local_date}`}
              />
              <h3>
                {p.local_date} · {p.pose}
              </h3>
              {p.note && <p>{p.note}</p>}
              <Button variant="ghost" onClick={() => setRemove(p.id)}>
                Delete photo
              </Button>
            </article>
          ))}
        </section>
      )}
      <Dialog
        open={Boolean(remove)}
        onOpenChange={(v) => {
          if (!v) setRemove(null);
        }}
      >
        <DialogContent
          title="Delete this photo?"
          description="The image and its note will be removed from your private history."
        >
          {error && <p role="alert">{error}</p>}
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () => deleteUpload(remove!),
                () => setRemove(null),
              )
            }
          >
            Delete permanently
          </Button>
        </DialogContent>
      </Dialog>
      <Link href="/progress" className="text-link">
        Back to progress →
      </Link>
    </div>
  );
}
