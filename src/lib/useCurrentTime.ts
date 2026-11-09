"use client";

import { useEffect, useState } from "react";

/** Supplies a stable client clock after hydration for time-sensitive UI. */
export function useCurrentTime() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return now;
}
