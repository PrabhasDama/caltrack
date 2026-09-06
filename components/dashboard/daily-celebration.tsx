"use client";
import { useEffect, useState } from "react";
import { haptic, claimCelebration } from "@/lib/feedback";
export function DailyCelebration({
  success,
  day,
  user,
}: {
  success: boolean;
  day: string;
  user: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!success) return;
    try {
      if (!claimCelebration(`caltrack:celebrated:${user}:${day}`, localStorage))
        return;
    } catch {
      return;
    }
    const start = setTimeout(() => {
        setVisible(true);
        haptic();
      }, 0),
      end = setTimeout(() => setVisible(false), 2200);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
    };
  }, [success, day, user]);
  if (!visible) return null;
  return (
    <div className="daily-celebration" role="status">
      <strong>Your daily checklist is complete. Nicely done.</strong>
      <span aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <i
            key={i}
            style={{ left: `${8 + i * 12}%`, animationDelay: `${i * 35}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
