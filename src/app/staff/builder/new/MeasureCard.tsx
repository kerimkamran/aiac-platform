"use client";

import { includesLeadership, type LevelKey } from "@/lib/levels";
import { LENGTH_TOTALS, type AssessmentLength, type GenerationLanguage, type QuestionMix } from "@/lib/generation";
import type { EngineKey } from "@/lib/ai-engine";
import type { AssessmentPurpose } from "../actions";
import { MAX_COMPETENCIES, type CatalogCompetency, type CatalogEngine } from "./types";

const PURPOSES: { value: AssessmentPurpose; label: string }[] = [
  { value: "hiring", label: "Hiring" },
  { value: "promotion", label: "Promotion" },
  { value: "development", label: "Development" },
];

const LENGTHS: { value: AssessmentLength; label: string }[] = [
  { value: "short", label: `Short · ${LENGTH_TOTALS.short} questions` },
  { value: "standard", label: `Standard · ${LENGTH_TOTALS.standard} questions` },
  { value: "deep", label: `Deep · ${LENGTH_TOTALS.deep} questions` },
];

const MIXES: { value: QuestionMix; label: string }[] = [
  { value: "balanced", label: "Balanced" },
  { value: "scenarios", label: "Mostly situational (multiple choice)" },
  { value: "open", label: "Mostly open-ended (behavioural)" },
];

const LANGUAGES: { value: GenerationLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "az", label: "Azərbaycan dili" },
  { value: "ru", label: "Русский" },
];

const CATEGORY_ORDER = ["Core", "Functional", "Leadership"];

export function MeasureCard({
  competencies,
  competencyIds,
  setCompetencyIds,
  length,
  setLength,
  mix,
  setMix,
  purpose,
  setPurpose,
  language,
  setLanguage,
  engine,
  setEngine,
  engines,
  defaultEngine,
  levelsIncluded,
}: {
  competencies: CatalogCompetency[];
  competencyIds: string[];
  setCompetencyIds: (next: string[]) => void;
  length: AssessmentLength;
  setLength: (v: AssessmentLength) => void;
  mix: QuestionMix;
  setMix: (v: QuestionMix) => void;
  purpose: AssessmentPurpose;
  setPurpose: (v: AssessmentPurpose) => void;
  language: GenerationLanguage;
  setLanguage: (v: GenerationLanguage) => void;
  engine: EngineKey | "";
  setEngine: (v: EngineKey | "") => void;
  engines: CatalogEngine[];
  defaultEngine: EngineKey;
  levelsIncluded: LevelKey[];
}) {
  const groups = CATEGORY_ORDER.map((cat) => ({ cat, items: competencies.filter((c) => c.category === cat) })).filter((g) => g.items.length > 0);
  const selectedLeadership = competencies.some((c) => c.category === "Leadership" && competencyIds.includes(c.id));
  const leadershipApplies = levelsIncluded.some((l) => includesLeadership(l));
  const atLimit = competencyIds.length >= MAX_COMPETENCIES;
  const defaultEngineName = engines.find((e) => e.key === defaultEngine)?.displayName ?? defaultEngine;

  function toggleCompetency(id: string) {
    if (competencyIds.includes(id)) setCompetencyIds(competencyIds.filter((x) => x !== id));
    else if (!atLimit) setCompetencyIds([...competencyIds, id]);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 space-y-5">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold text-foreground">3 · What to measure</h2>
        <span className="text-2xs font-semibold text-muted">
          {competencyIds.length} of {MAX_COMPETENCIES} competencies
        </span>
      </header>

      <div className="space-y-4">
        {groups.map((g) => (
          <fieldset key={g.cat} className="space-y-2">
            <legend className="text-xs font-semibold text-muted mb-1">{g.cat}</legend>
            <div className="grid sm:grid-cols-2 gap-2">
              {g.items.map((c) => {
                const on = competencyIds.includes(c.id);
                const disabled = !on && atLimit;
                return (
                  <label
                    key={c.id}
                    className={`flex items-start gap-2.5 text-sm rounded-xl border px-3 py-2 ${
                      on ? "border-accent bg-accent-soft" : "border-line bg-canvas"
                    } ${disabled ? "opacity-50" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={disabled}
                      onChange={() => toggleCompetency(c.id)}
                      className="mt-0.5 w-4 h-4 accent-[color:var(--brand)]"
                    />
                    <span>
                      <span className="font-medium text-foreground">{c.name}</span>
                      {c.description && <span className="block text-2xs text-muted line-clamp-2">{c.description}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        {selectedLeadership && !leadershipApplies && (
          <p className="text-xs text-warning bg-amber-50 rounded-lg px-3 py-2">
            Leadership competencies are only used for Manager, Director and C-level drafts. They will be left out of the Entry and Senior drafts.
          </p>
        )}
        {atLimit && <p className="text-2xs text-muted">Up to {MAX_COMPETENCIES} competencies per draft keeps each assessment focused.</p>}
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Length</p>
          <div role="radiogroup" aria-label="Length" className="space-y-1.5">
            {LENGTHS.map((l) => (
              <label key={l.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="length" checked={length === l.value} onChange={() => setLength(l.value)} className="accent-[color:var(--brand)]" />
                {l.label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="question-mix" className="text-xs font-semibold text-muted block">
            Question style
          </label>
          <select
            id="question-mix"
            value={mix}
            onChange={(e) => setMix(e.target.value as QuestionMix)}
            className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {MIXES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="purpose" className="text-xs font-semibold text-muted block">
            Purpose
          </label>
          <select
            id="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as AssessmentPurpose)}
            className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {PURPOSES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="language" className="text-xs font-semibold text-muted block">
            Candidate language
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as GenerationLanguage)}
            className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <details className="rounded-xl border border-line bg-canvas px-4 py-3">
        <summary className="text-sm font-semibold cursor-pointer text-foreground">Advanced</summary>
        <div className="mt-3 space-y-2">
          <label htmlFor="engine" className="text-xs font-semibold text-muted block">
            AI engine
          </label>
          <select
            id="engine"
            value={engine}
            onChange={(e) => setEngine(e.target.value as EngineKey | "")}
            className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Default ({defaultEngineName})</option>
            {engines.map((e) => (
              <option key={e.key} value={e.key} disabled={!e.enabled || !e.configured}>
                {e.displayName}
                {!e.configured ? " — no API key" : !e.enabled ? " — switched off" : e.allowContext ? "" : " — competencies and level only"}
              </option>
            ))}
          </select>
          <p className="text-2xs text-muted">
            Only engines approved in AI Governance receive job descriptions and reference files. Others get the competencies and level only.
          </p>
        </div>
      </details>
    </section>
  );
}
