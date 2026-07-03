"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

function readInitialTheme(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState(readInitialTheme);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("aiac-theme", next ? "dark" : "light");
    } catch {}
  };

  return (
    <button onClick={toggle} aria-label="Toggle dark mode" className={`inline-flex items-center gap-2 ${className}`}>
      <Icon name={isDark ? "sun" : "moon"} className="w-4 h-4" />
      <span suppressHydrationWarning>{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
