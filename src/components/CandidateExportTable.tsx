"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, Icon, ScoreBadge, StatusBadge } from "@/components/ui";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { nowMs } from "@/lib/time";

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

  // Design-execution-plan Phase 5 / T5.2: same DataTable primitive as the
  // admin users and audit tables now use, with row selection expressed as
  // an ordinary column (a checkbox column is just a column whose render
  // returns a checkbox) rather than the primitive needing to know selection
  // is a thing at all.
  const columns: DataTableColumn<CandidateExportRow>[] = [
    {
      key: "select",
      className: "w-10",
      headerRender: () => (
        // Design-execution-plan Phase 4 / T4.2: bare checkbox with no label
        // had no accessible name and a hit target under the browser default
        // ~13px -- WCAG 2.5.8/4.1.2.
        <label className="grid place-items-center w-6 h-6 -m-1 cursor-pointer">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all candidates" className="accent-[color:var(--brand)]" />
        </label>
      ),
      render: (r) => (
        <label className="grid place-items-center w-6 h-6 -m-1 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.has(r.id)}
            onChange={() => toggleOne(r.id)}
            aria-label={`Select ${r.candidate?.full_name || "candidate"}`}
            className="accent-[color:var(--brand)]"
          />
        </label>
      ),
    },
    {
      key: "candidate",
      label: "Candidate",
      className: "px-2",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.candidate?.full_name || "?"} />
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{r.candidate?.full_name}</p>
            <p className="text-xs text-muted truncate">{r.candidate?.email}</p>
          </div>
        </div>
      ),
    },
    { key: "assessment", label: "Assessment", render: (r) => <span className="text-muted">{r.assessments?.title}</span> },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <StatusBadge status={r.status} />
          {r.due_at && ["invited", "in_progress"].includes(r.status) && (
            <span
              className={`text-2xs font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${
                new Date(r.due_at).getTime() < nowMs()
                  ? "bg-[#fbeceb] text-[#b23b3b] ring-red-200"
                  : "bg-line-soft text-muted ring-line"
              }`}
            >
              {new Date(r.due_at).getTime() < nowMs() ? "Overdue" : `Due ${new Date(r.due_at).toLocaleDateString()}`}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "role_fit",
      label: "Role Fit",
      render: (r) => (r.overall_score !== null ? <ScoreBadge score={Math.round(r.overall_score)} /> : <span className="text-muted">—</span>),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) => (
        <Link
          href={`/staff/reports/candidates/${r.id}`}
          className="inline-flex items-center gap-1.5 text-accent-dark font-semibold whitespace-nowrap hover:underline"
        >
          Review
          <Icon name="arrowRight" className="w-3.5 h-3.5" />
        </Link>
      ),
    },
  ];

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
                ? "border-line text-muted cursor-not-allowed"
                : "border-brand text-accent-dark hover:bg-brand-deep hover:text-white"
            }`}
          >
            <Icon name="download" className="w-4 h-4" />
            Export selected
          </a>
          <a
            href={exportBase}
            className="inline-flex items-center gap-2 bg-brand-deep text-white text-sm font-semibold px-3.5 py-2 rounded-xl hover:bg-brand transition-colors"
          >
            <Icon name="download" className="w-4 h-4" />
            Export all (filtered)
          </a>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        caption="Candidates"
        emptyMessage="No candidates match — try clearing the filters, or invite candidates from the Assessment Builder."
      />

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
