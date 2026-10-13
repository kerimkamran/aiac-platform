"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateDraft, type AssessmentPurpose, type DraftInput, type DraftResult } from "../actions";
import { LEVELS, LEVEL_KEYS, includesLeadership, type LevelKey } from "@/lib/levels";
import { CONTEXT_BUDGET_CHARS, INSTRUCTIONS_MAX_CHARS, JD_MAX_CHARS, NOTES_MAX_CHARS } from "@/lib/ai-context";
import { RoleLevelPicker } from "./RoleLevelPicker";
import { ContextCard } from "./ContextCard";
import { MeasureCard } from "./MeasureCard";
import { GenerationProgress } from "./GenerationProgress";
import type { AssessmentLength, GenerationLanguage, QuestionMix } from "@/lib/generation";
import type { EngineKey } from "@/lib/ai-engine";
import { EMPTY_ROLE_CONTEXT, MAX_COMPETENCIES, type CatalogCompetency, type CatalogEngine, type Combo, type Job, type OneOff, type RoleContext } from "./types";

export type { CatalogCompetency, CatalogEngine } from "./types";

// Version 2: the form no longer stores positions (plan v2). Older saved state
// under the v1 key is ignored, so nobody restores a half-removed selection.
const STORAGE_KEY = "aiac-new-assessment-v2";
const MAX_COMBINATIONS = LEVEL_KEYS.length;
const CONCURRENCY = 2;
// Core competencies pre-selected; two places are kept free for Leadership.
const CORE_DEFAULT = 6;
const LEADERSHIP_SEED = 2;

type Saved = {
  jobTitle: string;
  levels: LevelKey[];
  ctx: RoleContext;
  instructions: string;
  oneOffs: OneOff[];
  competencyIds: string[];
  length: AssessmentLength;
  mix: QuestionMix;
  purpose: AssessmentPurpose;
  language: GenerationLanguage;
  engine: EngineKey | "";
  customTitle?: string;
};

function leadershipSeedIds(comps: CatalogCompetency[], alreadySelected: number): string[] {
  return comps
    .filter((c) => c.category === "Leadership")
    .slice(0, Math.max(0, Math.min(LEADERSHIP_SEED, MAX_COMPETENCIES - alreadySelected)))
    .map((c) => c.id);
}

function initialCompetencies(comps: CatalogCompetency[], levels: LevelKey[]): string[] {
  const core = comps.filter((c) => c.category === "Core").slice(0, CORE_DEFAULT).map((c) => c.id);
  if (!levels.some((l) => includesLeadership(l))) return core;
  return [...core, ...leadershipSeedIds(comps, core.length)];
}

// Orders levels the same way as the level table, so the chips read in order.
function sortLevels(levels: LevelKey[]): LevelKey[] {
  return LEVEL_KEYS.filter((l) => levels.includes(l));
}

export function NewAssessmentForm({
  competencies,
  engines,
  defaultEngine,
  canUseAi,
  aiDisabledReason,
  quota,
}: {
  competencies: CatalogCompetency[];
  engines: CatalogEngine[];
  defaultEngine: EngineKey;
  canUseAi: boolean;
  aiDisabledReason: string | null;
  quota: { used: number; total: number };
}) {
  const router = useRouter();

  const [jobTitle, setJobTitle] = useState("");
  const [levels, setLevels] = useState<LevelKey[]>([]);
  const [ctx, setCtx] = useState<RoleContext>(EMPTY_ROLE_CONTEXT);
  const [instructions, setInstructions] = useState("");
  const [oneOffs, setOneOffs] = useState<OneOff[]>([]);
  const [competencyIds, setCompetencyIds] = useState<string[]>(() => initialCompetencies(competencies, []));
  const [length, setLength] = useState<AssessmentLength>("standard");
  const [mix, setMix] = useState<QuestionMix>("balanced");
  const [purpose, setPurpose] = useState<AssessmentPurpose>("hiring");
  const [language, setLanguage] = useState<GenerationLanguage>("en");
  const [engine, setEngine] = useState<EngineKey | "">("");
  const [customTitle, setCustomTitle] = useState("");
  // Leadership competencies are added once, when a manager-or-above level is
  // first chosen, so the form starts with room for them. After that the
  // reviewer's own choices are never changed.
  const leadershipSeeded = useRef(false);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [running, setRunning] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const batchId = useRef<string>("");

  // Restore the form for this browser session (not across sessions), so an
  // error or a refresh does not lose what the admin typed.
  // Reading sessionStorage is an external system, so setting state from it
  // once on mount is the intended use here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Saved>;
        if (saved.jobTitle !== undefined) setJobTitle(saved.jobTitle);
        if (saved.levels) setLevels(saved.levels);
        if (saved.ctx) setCtx(saved.ctx);
        if (saved.instructions) setInstructions(saved.instructions);
        if (saved.oneOffs) setOneOffs(saved.oneOffs);
        if (saved.competencyIds) {
          setCompetencyIds(saved.competencyIds);
          leadershipSeeded.current = true;
        }
        if (saved.length) setLength(saved.length);
        if (saved.mix) setMix(saved.mix);
        if (saved.purpose) setPurpose(saved.purpose);
        if (saved.language) setLanguage(saved.language);
        if (saved.engine !== undefined) setEngine(saved.engine);
        if (saved.customTitle) setCustomTitle(saved.customTitle);
      }
    } catch {
      // Storage can be blocked or full; the form still works without it.
    }
    setRestored(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!restored) return;
    try {
      const saved: Saved = { jobTitle, levels, ctx, instructions, oneOffs, competencyIds, length, mix, purpose, language, engine, customTitle };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // ignore
    }
  }, [restored, jobTitle, levels, ctx, instructions, oneOffs, competencyIds, length, mix, purpose, language, engine, customTitle]);

  // Choosing a manager-or-above level seeds Leadership competencies once.
  function changeLevels(next: LevelKey[]) {
    setLevels(next);
    if (leadershipSeeded.current || !next.some((l) => includesLeadership(l))) return;
    leadershipSeeded.current = true;
    setCompetencyIds((ids) => {
      if (ids.some((id) => competencies.find((c) => c.id === id)?.category === "Leadership")) return ids;
      return [...ids, ...leadershipSeedIds(competencies, ids.length)];
    });
  }

  const combos: Combo[] = useMemo(
    () => sortLevels(levels).map((l) => ({ key: l, level: l, included: true })),
    [levels]
  );

  const includedCombos = combos.filter((c) => c.included);
  const remainingQuota = Math.max(0, quota.total - quota.used);
  const aiPossible = canUseAi && engines.some((e) => e.enabled && e.configured);

  function validate(): string | null {
    if (jobTitle.trim().length < 2) return "Type the job title first.";
    if (levels.length === 0) return "Choose at least one level.";
    if (includedCombos.length > MAX_COMBINATIONS) return `Generate at most ${MAX_COMBINATIONS} drafts at a time.`;
    if (competencyIds.length === 0) return "Choose at least one competency.";
    if (instructions.length > INSTRUCTIONS_MAX_CHARS) return `The shared instructions are longer than ${INSTRUCTIONS_MAX_CHARS.toLocaleString()} characters.`;
    if (ctx.jobDescription.length > JD_MAX_CHARS) return "The job description is too long.";
    if (ctx.notes.length > NOTES_MAX_CHARS) return "The notes are too long.";
    return null;
  }

  function buildInput(combo: Combo, attempt: number, empty: boolean): DraftInput {
    return {
      batchId: batchId.current,
      idempotencyKey: `${batchId.current}:${combo.key}:${attempt}`,
      vacancyTitle: jobTitle.trim(),
      level: combo.level,
      purpose,
      language,
      competencyIds,
      length,
      mix,
      engine: engine || null,
      instructions,
      jobDescription: ctx.jobDescription,
      notes: ctx.notes,
      files: ctx.files,
      customTitle: includedCombos.length === 1 ? customTitle : undefined,
      emptyDraft: empty,
    };
  }

  function setJob(key: string, patch: Partial<Job>) {
    setJobs((j) => ({ ...j, [key]: { ...(j[key] ?? { status: "queued", attempt: 1, empty: false, warnings: [], emptyDraftAllowed: true }), ...patch } as Job }));
  }

  async function runCombos(targets: Combo[], empty: boolean) {
    setRunning(true);
    const queue = [...targets];
    const worker = async () => {
      while (queue.length > 0) {
        const combo = queue.shift()!;
        const attempt = (jobs[combo.key]?.attempt ?? 0) + 1;
        setJob(combo.key, { status: "running", attempt, empty, error: undefined, warnings: [], startedAt: Date.now() });
        let result: DraftResult;
        try {
          result = await generateDraft(buildInput(combo, attempt, empty));
        } catch {
          result = { ok: false, error: "The connection dropped before the draft finished. Retry this one.", emptyDraftAllowed: true };
        }
        if (result.ok) {
          setJob(combo.key, { status: "done", assessmentId: result.assessmentId, warnings: result.warnings, error: undefined });
        } else {
          setJob(combo.key, { status: "failed", error: result.error, emptyDraftAllowed: result.emptyDraftAllowed, warnings: [] });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
    setRunning(false);
  }

  async function onGenerate() {
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    if (!aiPossible) {
      setFormError(aiDisabledReason || "AI generation isn't available. Use Create empty drafts instead.");
      return;
    }
    if (includedCombos.length > remainingQuota) {
      setFormError(`${includedCombos.length} drafts would exceed this month's AI quota (${remainingQuota} left). Remove a level, or create empty drafts.`);
      return;
    }
    batchId.current = crypto.randomUUID();
    setJobs(Object.fromEntries(includedCombos.map((c) => [c.key, { status: "queued", attempt: 0, empty: false, warnings: [], emptyDraftAllowed: true } as Job])));
    await runCombos(includedCombos, false);
  }

  async function onEmptyDrafts() {
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    batchId.current = crypto.randomUUID();
    await runCombos(includedCombos, true);
  }

  async function retry(key: string) {
    const combo = combos.find((c) => c.key === key);
    if (!combo) return;
    await runCombos([combo], jobs[key]?.empty === true);
  }

  const doneJobs = Object.entries(jobs).filter(([, j]) => j.status === "done" && j.assessmentId);
  const allFinished = Object.keys(jobs).length > 0 && Object.values(jobs).every((j) => j.status === "done" || j.status === "failed") && !running;

  useEffect(() => {
    if (allFinished && doneJobs.length === 1 && Object.keys(jobs).length === 1) {
      router.push(`/staff/builder/${doneJobs[0][1].assessmentId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFinished]);

  const contextEngine = engines.find((e) => e.key === (engine || defaultEngine));

  return (
    <div className="space-y-6">
      {formError && (
        <div role="alert" className="rounded-xl border border-critical/30 bg-red-50 text-critical text-sm px-4 py-3">
          {formError}
        </div>
      )}

      <RoleLevelPicker jobTitle={jobTitle} setJobTitle={setJobTitle} levels={levels} setLevels={changeLevels} />

      <ContextCard
        ctx={ctx}
        setCtx={setCtx}
        instructions={instructions}
        setInstructions={setInstructions}
        oneOffs={oneOffs}
        setOneOffs={setOneOffs}
        contextEngine={contextEngine}
      />

      <MeasureCard
        competencies={competencies}
        competencyIds={competencyIds}
        setCompetencyIds={setCompetencyIds}
        customTitle={customTitle}
        setCustomTitle={setCustomTitle}
        draftCount={includedCombos.length}
        length={length}
        setLength={setLength}
        mix={mix}
        setMix={setMix}
        purpose={purpose}
        setPurpose={setPurpose}
        language={language}
        setLanguage={setLanguage}
        engine={engine}
        setEngine={setEngine}
        engines={engines}
        defaultEngine={defaultEngine}
        levelsIncluded={levels}
      />

      <section className="rounded-2xl border border-line bg-surface p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-muted">
          <p className="font-semibold text-foreground">
            {includedCombos.length} draft{includedCombos.length === 1 ? "" : "s"} ready
          </p>
          <p className="text-xs mt-0.5">
            {quota.total > 0 ? `${remainingQuota} of ${quota.total} AI actions left this month.` : "AI quota is set to 0."}{" "}
            {includedCombos.length > 0 && (
              <>
                Context budget: up to {CONTEXT_BUDGET_CHARS.toLocaleString()} characters per draft. Every draft is reviewed by a person before it is published.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onEmptyDrafts}
            disabled={running || includedCombos.length === 0}
            className="text-sm font-semibold border border-line rounded-xl px-4 py-2.5 hover:border-accent disabled:opacity-50"
          >
            Create empty draft{includedCombos.length === 1 ? "" : "s"}
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={running || includedCombos.length === 0 || !aiPossible}
            className="text-sm font-semibold bg-brand-deep text-white rounded-xl px-5 py-2.5 hover:bg-brand disabled:opacity-50"
          >
            {running ? "Generating…" : "Generate"}
          </button>
        </div>
      </section>

      {!aiPossible && aiDisabledReason && <p className="text-xs text-muted">{aiDisabledReason}</p>}

      <GenerationProgress combos={includedCombos} jobTitle={jobTitle.trim()} jobs={jobs} running={running} onRetry={retry} />

      {allFinished && doneJobs.length > 1 && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <p className="font-semibold text-foreground mb-3">Drafts ready to review</p>
          <ul className="space-y-2">
            {doneJobs.map(([key, j]) => (
              <li key={key}>
                <Link href={`/staff/builder/${j.assessmentId}`} className="text-sm text-accent-dark hover:underline">
                  {jobTitle.trim()} — {LEVELS[combos.find((c) => c.key === key)!.level].label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
