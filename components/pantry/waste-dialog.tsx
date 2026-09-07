"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/dashboard/use-mutation";
import { recordWaste } from "@/app/(app)/pantry/actions";
import type { PantryRecord } from "@/lib/pantry/inventory";
export function WasteDialog({ item }: { item: PantryRecord }) {
  const [open, setOpen] = useState(false),
    [id, setId] = useState(() => crypto.randomUUID());
  const { run, pending, error } = useMutation();
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setId(crypto.randomUUID());
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" disabled={!item.quantity_g}>
          Record waste
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Record unused food"
        description="Removes the remaining quantity from pantry and records why. Upcoming grocery needs update automatically."
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              () =>
                recordWaste({
                  id,
                  pantry: item.id,
                  expected: item.updated_at,
                  reason: f.get("reason"),
                }),
              () => setOpen(false),
            );
          }}
        >
          <label className="field">
            Reason
            <select name="reason">
              <option value="expired">Expired</option>
              <option value="discarded">Thrown away / discarded</option>
            </select>
          </label>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <Button disabled={pending}>Confirm unused food</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
