"use client";

import { useEffect } from "react";

/**
 * The exam keeps the candidate's answers on the device until the server has
 * confirmed the submission. This runs on the confirmation page only.
 */
export function ClearDraft({ caId }: { caId: string }) {
  useEffect(() => {
    try {
      localStorage.removeItem(`aiac-exam-${caId}`);
      localStorage.removeItem(`aiac-answers-${caId}`);
    } catch {}
  }, [caId]);
  return null;
}
