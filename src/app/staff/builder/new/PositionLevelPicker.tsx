"use client";

import { useMemo, useState } from "react";
import { LEVELS, LEVEL_KEYS, type LevelKey } from "@/lib/levels";
import type { CatalogPosition, Combo, PositionSel } from "./types";

export function PositionLevelPicker({
  catalog,
  positionsSel,
  setPositionsSel,
  levels,
  setLevels,
  combos,
  onToggleCombo,
  onNeedContext,
}: {
  catalog: CatalogPosition[];
  positionsSel: PositionSel[];
  setPositionsSel: (next: PositionSel[]) => void;
  levels: LevelKey[];
  setLevels: (next: LevelKey[]) => void;
  combos: Combo[];
  onToggleCombo: (key: string) => void;
  onNeedContext: (sel: PositionSel) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedIds = new Set(positionsSel.map((p) => p.positionId).filter(Boolean));
  const q = query.trim().toLowerCase();

  const matches = useMemo(
    () => catalog.filter((p) => !selectedIds.has(p.id) && (q === "" || p.title.toLowerCase().includes(q))).slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, q, positionsSel]
  );
  const exactExists = catalog.some((p) => p.title.trim().toLowerCase() === q);

  function addExisting(p: CatalogPosition) {
    const sel: PositionSel = { key: p.id, positionId: p.id, title: p.title, department: p.department, defaultLevel: p.defaultLevel };
    setPositionsSel([...positionsSel, sel]);
    if (levels.length === 0) setLevels([p.defaultLevel]);
    onNeedContext(sel);
    setQuery("");
  }

  function addNew() {
    const title = query.trim();
    if (title.length < 2) return;
    const key = `new:${title.toLowerCase()}`;
    const sel: PositionSel = { key, positionId: null, title, department: null, defaultLevel: "manager" };
    setPositionsSel([...positionsSel, sel]);
    if (levels.length === 0) setLevels(["manager"]);
    onNeedContext(sel);
    setQuery("");
  }

  function remove(key: string) {
    setPositionsSel(positionsSel.filter((p) => p.key !== key));
  }

  function toggleLevel(l: LevelKey) {
    setLevels(levels.includes(l) ? levels.filter((x) => x !== l) : [...levels, l]);
  }

  const sortedLevels = LEVEL_KEYS.filter((l) => levels.includes(l));

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 space-y-5">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold text-foreground">1 · Who is it for?</h2>
        <span className="text-2xs font-semibold text-muted">Required</span>
      </header>

      <div className="space-y-2">
        <label htmlFor="position-search" className="text-xs font-semibold text-muted block">
          Position(s)
        </label>
        <div className="flex flex-wrap gap-2">
          {positionsSel.map((p) => (
            <span key={p.key} className="inline-flex items-center gap-2 text-sm bg-accent-soft text-accent-dark rounded-full px-3 py-1">
              {p.title}
              {p.positionId === null && <span className="text-2xs opacity-70">(new)</span>}
              <button type="button" onClick={() => remove(p.key)} aria-label={`Remove ${p.title}`} className="font-bold hover:text-critical">
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          id="position-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches[0]) addExisting(matches[0]);
              else if (!exactExists) addNew();
            }
          }}
          placeholder="Search positions, or type a new one"
          className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {q && (
          <ul className="rounded-xl border border-line divide-y divide-line bg-canvas">
            {matches.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => addExisting(p)} className="w-full text-left px-3.5 py-2 text-sm hover:bg-accent-soft">
                  {p.title}
                  {p.department && <span className="text-muted"> · {p.department}</span>}
                </button>
              </li>
            ))}
            {!exactExists && q.length >= 2 && (
              <li>
                <button type="button" onClick={addNew} className="w-full text-left px-3.5 py-2 text-sm font-semibold text-accent-dark hover:bg-accent-soft">
                  Create position “{query.trim()}”
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted">Level(s)</p>
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

      {positionsSel.length > 0 && sortedLevels.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Drafts to create — untick anything that doesn&apos;t apply</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-2xs text-muted">
                  <th className="py-2 pr-3 font-semibold">Position</th>
                  {sortedLevels.map((l) => (
                    <th key={l} className="py-2 px-2 font-semibold text-center">
                      {LEVELS[l].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positionsSel.map((p) => (
                  <tr key={p.key} className="border-t border-line">
                    <td className="py-2 pr-3 font-medium text-foreground">{p.title}</td>
                    {sortedLevels.map((l) => {
                      const combo = combos.find((c) => c.posKey === p.key && c.level === l);
                      return (
                        <td key={l} className="py-2 px-2 text-center">
                          {combo && (
                            <input
                              type="checkbox"
                              aria-label={`${p.title}, ${LEVELS[l].label}`}
                              checked={combo.included}
                              onChange={() => onToggleCombo(combo.key)}
                              className="w-4 h-4 accent-[color:var(--brand)]"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
