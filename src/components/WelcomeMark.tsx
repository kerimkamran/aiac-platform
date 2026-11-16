"use client";

import { useEffect, useState } from "react";
import { VantageMark } from "@/components/VantageMark";

// Moment W1: the mark draws itself the first time someone arrives, then stays
// out of the way. "First" means once per browser; if storage is unavailable
// nothing is shown, so the page is never worse for it.
const KEY = "vantage-welcomed";

export function WelcomeMark({ className = "w-10 h-10" }: { className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) {
        window.localStorage.setItem(KEY, "1");
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser storage once after mount
        setShow(true);
      }
    } catch {}
  }, []);
  if (!show) return null;
  return <VantageMark animate tile={false} className={className} />;
}
