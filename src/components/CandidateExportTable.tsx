"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, Card, Icon, ScoreBadge, StatusBadge } from "@/components/ui";

export type CandidateExportRow = {
  id: string;
  status: string;
  overall_score: number | null;
  due_at?: string | null;
  candidate: { full_name: string; email: string } | null;
  assessments: { title: string } | null;
};

export function CandidateExportTable({ rows, exportBase }: { rows: CandidateExportRow[]; exportBase: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allChecked = rows.length > 0 && selected.size === rows.length;

  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedExportUrl = useMemo(() => {
    const sep = exportBase.includes("?") ? "&" : "?";
    return `${exportBase}${sep}ids=${Array.from(selected).join(",")}`;
  }, [exportBase, selected]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-xs text-muted">{selected.size > 0 ? `${selected.size} selected` : `${rows.length} candidates`}</p>
        <div className="flex items-center gap-2">
          <a
            href={selectedExportUrl}
            aria-disabled={selected.size === 0}
            onClick={(e) => {
              if (selected.size === 0) e.preventDefault();
            }}
            className={`inline-flex items-center gap-2 text-sm font-semibold px-3.5 py-2 rounded-xl border transition-colors ${
              selected.size === 0
                ? "border-line text-faint cursor-not-allowed"
                : "border-brand text-brand hover:bg-brand hover:text-white"
            }`}
          >
            <Icon name="download" className="w-4 h-4" />
            Export selected
          </a>
          <a
            href={exportBase}
            className="inline-flex items-center gap-2 bg-brand text-white text-sm font-semibold px-3.5 py-2 rounded-xl hover:bg-brand-light transition-colors"
          >
            <Icon name="download" className="w-4 h-4" />
            Export all (filtered)
          </a>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead className="text-faint text-[11px] uppercase tracking-wider border-b border-line">
            <tr>
              <th className="px-4 py-3.5 w-10">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="accent-[color:var(--brand)]" />
              </th>
              <th className="text-left px-2 py-3.5 font-semibold">Candidate</th>
              <th className="text-left px-5 py-3.5 font-semibold">Assessment</th>
              <th className="text-left px-5 py-3.5 font-semibold">Status</th>
              <th className="text-left px-5 py-3.5 font-semibold">Role Fit</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-background/70 transition-colors">
                <td className="px-4 py-3.5">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} className="accent-[color:var(--brand)]" />
                </td>
                <td className="px-2 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.candidate?.full_name || "?"} />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{r.candidate?.full_name}</p>
                      <p className="text-xs text-muted truncate">{r.candidate?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-muted">{r.assessments?.title}</td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    {r.due_at && ["invited", "in_progress"].includes(r.status) && (
                      <span
                        className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${
                          new Date(r.due_at).getTime() < Date.now()
                            ? "bg-[#fbeceb] text-[#b23b3b] ring-red-200"
                            : "bg-line-soft text-muted ring-line"
                        }`}
                      >
                        {new Date(r.due_at).getTime() < Date.now() ? "Overdue" : `Due ${new Date(r.due_at).toLocaleDateString()}`}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {r.overall_score !== null ? <ScoreBadge score={Math.round(r.overall_score)} /> : <span className="text-faint">—</span>}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link
                    href={`/staff/reports/candidates/${r.id}`}
                    className="inline-flex items-center gap-1.5 text-accent-dark font-semibold whitespace-nowrap hover:underline"
                  >
                    Review
                    <Icon name="arrowRight" className="w-3.5 h-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-faint text-sm">
                  No candidates match — try clearing the filters, or invite candidates from the Assessment Builder.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {selected.size >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 no-print anim-fade-up">
          <div className="flex items-center gap-3 bg-foreground text-white rounded-2xl shadow-2xl px-4 py-2.5">
            <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{selected.size} selected</span>
            {selected.size <= 4 ? (
              <Link
                href={`/staff/compare?ids=${Array.from(selected).join(",")}`}
                className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors text-sm font-bold px-3.5 py-1.5 rounded-xl whitespace-nowrap"
              >
                <Icon name="chart" className="w-4 h-4" />
                Compare
              </Link>
            ) : (
              <span className="text-xs text-white/60 whitespace-nowrap">Compare supports up to 4</span>
            )}
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs font-semibold text-white/60 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </>
  );
}
