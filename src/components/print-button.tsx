"use client";

import { Icon } from "@/components/ui";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 border border-line bg-surface text-foreground text-sm font-semibold px-4 py-2.5 rounded-xl hover:border-brand transition-colors no-print"
    >
      <Icon name="printer" className="w-4 h-4" />
      Print report
    </button>
  );
}
