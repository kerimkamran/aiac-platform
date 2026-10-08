import type { LevelKey } from "@/lib/levels";
import type { EngineKey } from "@/lib/ai-engine";

export type CatalogPosition = { id: string; title: string; department: string | null; defaultLevel: LevelKey; fileCount: number };
export type CatalogEngine = { key: EngineKey; displayName: string; enabled: boolean; configured: boolean; allowContext: boolean };
export type CatalogCompetency = { id: string; code: string; name: string; category: string; description: string | null };

export type PositionSel = { key: string; positionId: string | null; title: string; department: string | null; defaultLevel: LevelKey };

export type PositionContext = {
  loaded: boolean;
  jobDescription: string;
  notes: string;
  files: { name: string; text: string }[];
  saveContext: boolean;
};

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

export type Combo = { key: string; posKey: string; level: LevelKey; included: boolean };
