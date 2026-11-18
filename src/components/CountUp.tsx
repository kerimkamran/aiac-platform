"use client";

import { useEffect, useState } from "react";

/**
 * Moment W5: a score counts up when a result opens. The final number is what
 * the server renders, so it is visible at rest and for anyone with reduced
 * motion; the count only runs in the browser, once, over `ms`.
 */
export function CountUp({ value, ms = 800 }: { value: number; ms?: number }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, ms]);

  return <>{shown}</>;
}
