import type { LevelKey } from "@/lib/levels";
import type { EngineKey } from "@/lib/ai-engine";

export type CatalogEngine = { key: EngineKey; displayName: string; enabled: boolean; configured: boolean; allowContext: boolean };
export type CatalogCompetency = { id: string; code: string; name: string; category: string; description: string | null };

// The job title is free text (positions were removed in plan v2). It is saved
// on the assessment as vacancy_title, and the batch context is sent with it.
export type RoleContext = {
  jobDescription: string;
  notes: string;
  files: { name: string; text: string }[];
};

export const EMPTY_ROLE_CONTEXT: RoleContext = { jobDescription: "", notes: "", files: [] };

export type OneOff = { name: string; text: string };

export const MAX_COMPETENCIES = 8;

export type Job = {
  status: "queued" | "running" | "done" | "failed";
  attempt: number;
  // When the current attempt started (ms since epoch), for the elapsed timer.
  startedAt?: number;
  // true when this draft was created without AI (empty draft mode).
  empty: boolean;
  assessmentId?: string;
  error?: string;
  warnings: string[];
  emptyDraftAllowed: boolean;
};

// One draft per level. The key is the level itself.
export type Combo = { key: string; level: LevelKey; included: boolean };
