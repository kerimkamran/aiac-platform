"use client";

// In-section case picker for Assessment Builder's "Add from Case Library".
// Client component only for the competency filter + checkbox selection UX --
// the actual insert happens via the addQuestionsFromCases server action the
// enclosing <form> already points at (see builder/[id]/page.tsx).

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui";

type CaseRow = {
  id: string;
  competency_id: string | null;
  title: string | null;
  question_stem: string | null;
  question_type: string;
  difficulty: string | null;
  competencies: { name: string } | null;
};

export function CaseLibraryPicker({ cases, defaultCompetencyId }: { cases: CaseRow[]; defaultCompetencyId: string | null }) {
  const [competencyId, setCompetencyId] = useState<string>(defaultCompetencyId || "");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const competencyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of cases) {
      if (c.competency_id && c.competencies?.name && !seen.has(c.competency_id)) {
        seen.set(c.competency_id, c.competencies.name);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [cases]);

  const filtered = competencyId ? cases.filter((c) => c.competency_id === competencyId) : cases;

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <select
        value={competencyId}
        onChange={(e) => setCompetencyId(e.target.value)}
        className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">All competencies ({cases.length} cases)</option>
        {competencyOptions.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>

      <div className="max-h-56 overflow-y-auto space-y-1.5">
        {filtered.length === 0 && <p className="text-xs text-faint py-3">No cases for this competency yet.</p>}
        {filtered.map((c) => (
          <label
            key={c.id}
            className={`flex items-start gap-2.5 text-xs rounded-lg px-3 py-2.5 border cursor-pointer transition-colors ${
              selected.has(c.id) ? "border-accent bg-accent-soft" : "border-line hover:bg-line-soft"
            }`}
          >
            <input
              type="checkbox"
              name="case_id"
              value={c.id}
              checked={selected.has(c.id)}
              onChange={() => toggle(c.id)}
              className="mt-0.5 w-3.5 h-3.5 rounded border-line accent-brand shrink-0"
            />
            <span className="min-w-0">
              <span className="font-semibold text-foreground block truncate">{c.title || "Untitled case"}</span>
              <span className="text-muted block line-clamp-2">{c.question_stem}</span>
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-faint mt-1">
                <Icon name={c.question_type === "mcq" ? "checkCircle" : "file"} className="w-3 h-3" />
                {c.question_type === "mcq" ? "MCQ" : "Open"}
                {c.difficulty ? ` · ${c.difficulty}` : ""}
                {c.competencies?.name ? ` · ${c.competencies.name}` : ""}
              </span>
            </span>
          </label>
        ))}
      </div>

      <button
        type="submit"
        disabled={selected.size === 0}
        className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Add {selected.size > 0 ? selected.size : ""} question{selected.size === 1 ? "" : "s"}
      </button>
    </>
  );
}
