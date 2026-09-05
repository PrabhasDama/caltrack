"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/(app)/dashboard/actions";
export function useMutation() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setError("");
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else {
          router.refresh();
          onSuccess?.();
        }
      } catch {
        setError("We couldn’t save your update. Please try again.");
      }
    });
  }
  return { pending, error, run };
}
