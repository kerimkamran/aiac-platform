"use client";

import { LEVELS, LEVEL_KEYS, type LevelKey } from "@/lib/levels";

// Step 1: the job title (free text) and the level or levels to draft for.
// One draft is made per level. Positions and the position x level grid were
// removed in plan v2.
export function RoleLevelPicker({
  jobTitle,
  setJobTitle,
  levels,
  setLevels,
}: {
  jobTitle: string;
  setJobTitle: (next: string) => void;
  levels: LevelKey[];
  setLevels: (next: LevelKey[]) => void;
}) {
  function toggleLevel(l: LevelKey) {
    setLevels(levels.includes(l) ? levels.filter((x) => x !== l) : [...levels, l]);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 space-y-5">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold text-foreground">1 · Who is it for?</h2>
        <span className="text-2xs font-semibold text-muted">Required</span>
      </header>

      <div className="space-y-2">
        <label htmlFor="job-title" className="text-xs font-semibold text-muted block">
          Job title / vacancy
        </label>
        <input
          id="job-title"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          maxLength={120}
          placeholder="e.g. Customer Care Team Lead"
          className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted">Level(s) — one draft is made for each</p>
        <div role="group" aria-label="Levels" className="flex flex-wrap gap-2">
          {LEVEL_KEYS.map((l) => {
            const on = levels.includes(l);
            return (
              <button
                key={l}
                type="button"
                aria-pressed={on}
                onClick={() => toggleLevel(l)}
                className={`text-sm rounded-full px-3.5 py-1.5 ring-1 ring-inset transition-colors ${
                  on ? "bg-brand-deep text-white ring-brand-deep" : "bg-canvas text-foreground ring-line hover:ring-accent"
                }`}
              >
                {LEVELS[l].label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
