"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated, uncached image endpoint; the optimizer must not cache private media. */
import { useState } from "react";
export function PrivateImage({ id, alt }: { id: string; alt: string }) {
  const [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  return failed ? (
    <div className="notice">
      <p>Your image could not load. Check your connection or sign in again.</p>
      <button
        type="button"
        className="text-button"
        onClick={() => {
          setRetry((r) => r + 1);
          setFailed(false);
        }}
      >
        Reload image
      </button>
    </div>
  ) : (
    <img
      src={`/api/media/${id}?retry=${retry}`}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
