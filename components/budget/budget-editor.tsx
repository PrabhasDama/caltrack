"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/dashboard/use-mutation";
import { updateBudget } from "@/app/(app)/budget/actions";
import type { Currency } from "@/lib/pricing/types";
export function BudgetEditor({
  amount,
  currency,
}: {
  amount: number;
  currency: Currency;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useMutation();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Edit monthly budget</Button>
      </DialogTrigger>
      <DialogContent
        title="A budget that fits your life."
        description="This is your ongoing monthly target. Purchases keep their original currency; no currency conversion is applied."
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              () =>
                updateBudget({
                  amount: Number(f.get("amount")),
                  currency: f.get("currency"),
                }),
              () => setOpen(false),
            );
          }}
        >
          <label className="field">
            Monthly grocery budget
            <input
              name="amount"
              type="number"
              min="20"
              max="10000"
              step=".01"
              required
              defaultValue={amount}
            />
          </label>
          <label className="field">
            Budget currency
            <select name="currency" defaultValue={currency}>
              <option>USD</option>
              <option>CAD</option>
            </select>
          </label>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <Button disabled={pending}>
            {pending ? "Saving…" : "Save budget"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
