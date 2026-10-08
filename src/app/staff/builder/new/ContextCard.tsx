"use client";

import { useState } from "react";
import type { CatalogEngine, OneOff, PositionContext, PositionSel } from "./types";
import { CONTEXT_BUDGET_CHARS, INSTRUCTIONS_MAX_CHARS, JD_MAX_CHARS, MAX_REFERENCE_FILES, NOTES_MAX_CHARS, REFERENCE_FILE_MAX_CHARS } from "@/lib/ai-context";
import { readDocxText, readTextFile } from "./files";

const STARTERS = [
  "Telecom context",
  "Customer escalation",
  "Competing priorities",
  "Tight deadline",
  "Budget trade-off",
  "Simple wording",
  "Avoid technical jargon",
];

const STARTER_TEXT: Record<string, string> = {
  "Telecom context": "The organisation is a telecoms operator. Use realistic network, subscriber and regulator details.",
  "Customer escalation": "Include a customer escalation that reaches senior management during the scenario.",
  "Competing priorities": "Make the candidate choose between two priorities that both matter to the business.",
  "Tight deadline": "Set a hard deadline of a few days within the scenario.",
  "Budget trade-off": "Include a budget or resource trade-off the candidate must weigh.",
  "Simple wording": "Use plain, short sentences.",
  "Avoid technical jargon": "Avoid technical jargon; a generalist manager should follow every case.",
};

export function ContextCard({
  positionsSel,
  ctx,
  setCtx,
  instructions,
  setInstructions,
  oneOffs,
  setOneOffs,
  contextEngine,
  onNeedContext,
}: {
  positionsSel: PositionSel[];
  ctx: Record<string, PositionContext>;
  setCtx: (fn: (c: Record<string, PositionContext>) => Record<string, PositionContext>) => void;
  instructions: string;
  setInstructions: (s: string) => void;
  oneOffs: OneOff[];
  setOneOffs: (fn: (o: OneOff[]) => OneOff[]) => void;
  contextEngine: CatalogEngine | undefined;
  onNeedContext: (sel: PositionSel) => void;
}) {
  const [tab, setTab] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const activeKey = tab && positionsSel.some((p) => p.key === tab) ? tab : positionsSel[0]?.key ?? null;
  const active = positionsSel.find((p) => p.key === activeKey) ?? null;
  const activeCtx: PositionContext | undefined = activeKey ? ctx[activeKey] : undefined;

  const used =
    instructions.length +
    Object.values(ctx).reduce((n, c) => n + c.jobDescription.length + c.notes.length + c.files.reduce((m, f) => m + f.text.length, 0), 0) +
    oneOffs.reduce((n, f) => n + f.text.length, 0);
  const pct = Math.min(100, Math.round((used / CONTEXT_BUDGET_CHARS) * 100));

  function patchCtx(key: string, patch: Partial<PositionContext>) {
    setCtx((c) => {
      const base: PositionContext = c[key] ?? { loaded: true, jobDescription: "", notes: "", files: [], saveContext: true };
      return { ...c, [key]: { ...base, ...patch } };
    });
  }

  function addStarter(label: string) {
    const line = STARTER_TEXT[label];
    if (!line) return;
    setInstructions(instructions.trim() ? `${instructions.trim()}\n${line}` : line);
  }

  async function onJdFile(file: File | undefined) {
    if (!file || !active) return;
    setNotice(null);
    if (file.name.toLowerCase().endsWith(".docx")) {
      const r = await readDocxText(file);
      if (!r.ok) return setNotice(r.error);
      patchCtx(active.key, { jobDescription: r.text });
    } else {
      const r = await readTextFile(file);
      if (!r.ok) return setNotice(r.error);
      patchCtx(active.key, { jobDescription: r.text });
    }
  }

  async function onReferenceFile(file: File | undefined) {
    if (!file || !active || !activeCtx) return;
    setNotice(null);
    if (activeCtx.files.length >= MAX_REFERENCE_FILES) return setNotice(`A position can have at most ${MAX_REFERENCE_FILES} reference files. Remove one first.`);
    const r = await readTextFile(file);
    if (!r.ok) return setNotice(r.error);
    patchCtx(active.key, { files: [...activeCtx.files, { name: r.name, text: r.text }] });
  }

  async function onOneOff(file: File | undefined) {
    if (!file) return;
    setNotice(null);
    if (oneOffs.length >= MAX_REFERENCE_FILES) return setNotice(`At most ${MAX_REFERENCE_FILES} one-off files per batch.`);
    const r = await readTextFile(file);
    if (!r.ok) return setNotice(r.error);
    setOneOffs((o) => [...o, { name: r.name, text: r.text }]);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 space-y-5">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold text-foreground">2 · Help the AI understand the role</h2>
        <span className="text-2xs font-semibold text-muted">Optional</span>
      </header>

      {notice && (
        <p role="alert" className="text-xs text-critical bg-red-50 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      <div className="space-y-2">
        <label htmlFor="shared-instructions" className="text-xs font-semibold text-muted block">
          Instructions for all drafts in this batch
        </label>
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addStarter(s)}
              className="text-2xs font-semibold rounded-full px-2.5 py-1 ring-1 ring-inset ring-line hover:ring-accent"
            >
              + {s}
            </button>
          ))}
        </div>
        <textarea
          id="shared-instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          maxLength={INSTRUCTIONS_MAX_CHARS + 500}
          placeholder="e.g. Focus on enterprise B2B clients; include a pricing conflict."
          className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <p className="text-2xs text-muted">
          {instructions.length.toLocaleString()} / {INSTRUCTIONS_MAX_CHARS.toLocaleString()} characters
        </p>
      </div>

      {positionsSel.length > 0 && (
        <div className="space-y-3">
          <div role="tablist" aria-label="Positions" className="flex flex-wrap gap-2 border-b border-line">
            {positionsSel.map((p) => (
              <button
                key={p.key}
                role="tab"
                aria-selected={p.key === activeKey}
                type="button"
                onClick={() => {
                  setTab(p.key);
                  if (!ctx[p.key]?.loaded) onNeedContext(p);
                }}
                className={`text-sm px-3 py-2 -mb-px border-b-2 ${p.key === activeKey ? "border-accent text-foreground font-semibold" : "border-transparent text-muted"}`}
              >
                {p.title}
              </button>
            ))}
          </div>

          {active && activeCtx && (
            <div role="tabpanel" className="space-y-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor={`jd-${active.key}`} className="text-xs font-semibold text-muted">
                    Job description
                  </label>
                  <label className="text-xs font-semibold text-accent-dark cursor-pointer hover:underline">
                    Upload .md / .txt / .docx
                    <input
                      type="file"
                      accept=".md,.txt,.docx,text/markdown,text/plain"
                      className="sr-only"
                      onChange={(e) => void onJdFile(e.target.files?.[0])}
                    />
                  </label>
                </div>
                <textarea
                  id={`jd-${active.key}`}
                  value={activeCtx.jobDescription}
                  onChange={(e) => patchCtx(active.key, { jobDescription: e.target.value })}
                  rows={6}
                  placeholder="Paste the job description, or upload one."
                  className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p className="text-2xs text-muted">{activeCtx.jobDescription.length.toLocaleString()} / {JD_MAX_CHARS.toLocaleString()} characters</p>
              </div>

              <div className="space-y-2">
                <label htmlFor={`notes-${active.key}`} className="text-xs font-semibold text-muted block">
                  Notes for this position
                </label>
                <textarea
                  id={`notes-${active.key}`}
                  value={activeCtx.notes}
                  onChange={(e) => patchCtx(active.key, { notes: e.target.value })}
                  rows={2}
                  placeholder="e.g. Must handle the top-10 accounts; quarterly targets."
                  className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p className="text-2xs text-muted">{activeCtx.notes.length.toLocaleString()} / {NOTES_MAX_CHARS.toLocaleString()} characters</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted">Reference files (up to {MAX_REFERENCE_FILES}, {Math.round(REFERENCE_FILE_MAX_CHARS / 1024)} KB each)</p>
                <ul className="space-y-1.5">
                  {activeCtx.files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 text-sm bg-canvas border border-line rounded-lg px-3 py-2">
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => patchCtx(active.key, { files: activeCtx.files.filter((_, j) => j !== i) })}
                        className="text-2xs font-semibold text-muted hover:text-critical"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                {activeCtx.files.length < MAX_REFERENCE_FILES && (
                  <label className="inline-flex text-xs font-semibold text-accent-dark cursor-pointer hover:underline">
                    + Attach .md or .txt
                    <input type="file" accept=".md,.txt,text/markdown,text/plain" className="sr-only" onChange={(e) => void onReferenceFile(e.target.files?.[0])} />
                  </label>
                )}
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeCtx.saveContext}
                  onChange={(e) => patchCtx(active.key, { saveContext: e.target.checked })}
                  className="w-4 h-4 accent-[color:var(--brand)]"
                />
                Save changes to this position for next time
              </label>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted">One-off material for this batch (not saved)</p>
        <ul className="flex flex-wrap gap-2">
          {oneOffs.map((f, i) => (
            <li key={`${f.name}-${i}`} className="inline-flex items-center gap-2 text-xs bg-canvas border border-line rounded-full px-3 py-1">
              {f.name}
              <button type="button" onClick={() => setOneOffs((o) => o.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="font-bold hover:text-critical">
                ×
              </button>
            </li>
          ))}
          {oneOffs.length < MAX_REFERENCE_FILES && (
            <li>
              <label className="inline-flex text-xs font-semibold text-accent-dark cursor-pointer hover:underline">
                + Attach .md or .txt
                <input type="file" accept=".md,.txt,text/markdown,text/plain" className="sr-only" onChange={(e) => void onOneOff(e.target.files?.[0])} />
              </label>
            </li>
          )}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex-1 min-w-[12rem]">
          <div className="h-1.5 rounded-full bg-line overflow-hidden" aria-hidden>
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-2xs text-muted mt-1">
            Context used {pct}% · Emails and phone numbers are removed before anything is sent.
          </p>
        </div>
        <a href="/brief-template.md" download className="text-xs font-semibold text-accent-dark hover:underline">
          Download brief template (.md)
        </a>
      </div>

      <p className="text-2xs text-muted">
        Your instructions shape the scenarios. They can&apos;t change what is measured, the answer keys, or the fairness rules.
      </p>

      {contextEngine && !contextEngine.allowContext && (
        <p className="text-xs text-warning bg-amber-50 rounded-lg px-3 py-2">
          {contextEngine.displayName} isn&apos;t approved to receive job descriptions or files. Drafts will be generated from the competencies and level only, unless you switch to an approved engine in Advanced.
        </p>
      )}
    </section>
  );
}
