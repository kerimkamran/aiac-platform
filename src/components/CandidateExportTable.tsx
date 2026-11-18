"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, Icon, ScoreBadge, StatusBadge } from "@/components/ui";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { nowMs } from "@/lib/time";
import { buttonClass } from "@/components/ui/Button";
import { ageText, fillText, pluralText, relativeTimeText } from "@/lib/dates";
import type { Dict } from "@/i18n/en";
import type { Lang } from "@/i18n";
import { candidateTrail } from "@/lib/candidate-trail";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CopyInviteLinkButton } from "@/components/CopyInviteLinkButton";
import { resendCandidateInvite } from "@/app/staff/people/actions";

const LOCALE: Record<Lang, string> = { en: "en-GB", az: "az-Latn-AZ", ru: "ru-RU" };

export type CandidateExportRow = {
  id: string;
  status: string;
  overall_score: number | null;
  due_at?: string | null;
  submitted_at?: string | null;
  // When the person last signed in; empty means they have not used the invitation yet.
  lastLoginAt?: string | null;
  // Answers the scorer was not sure about and nobody has confirmed yet.
  flags?: number;
  // STF-B-12: who most recently decided, and when -- so two reviewers
  // deciding on the same candidate at once is visible here too, not only on
  // the report page.
  decidedBy?: string | null;
  decidedAt?: string | null;
  candidate: { full_name: string; email: string } | null;
  assessments: { title: string } | null;
};

export function CandidateExportTable({
  rows,
  exportBase,
  canCopyLink = false,
  lang,
  text,
}: {
  rows: CandidateExportRow[];
  exportBase: string;
  canCopyLink?: boolean;
  lang: Lang;
  text: Dict["staff"];
}) {
  const t = text.candidates;
  const trailCurrent = (i: number) =>
    i === 0 ? text.trail.invitedNotSignedIn : i === 1 ? text.trail.signedInNotStarted : text.trail.steps[i] ?? "";
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
          <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label={t.selectAll} className="accent-[color:var(--brand)]" />
        </label>
      ),
      render: (r) => (
        <label className="grid place-items-center w-6 h-6 -m-1 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.has(r.id)}
            onChange={() => toggleOne(r.id)}
            aria-label={fillText(t.selectOne, { name: r.candidate?.full_name || t.col.candidate })}
            className="accent-[color:var(--brand)]"
          />
        </label>
      ),
    },
    {
      key: "candidate",
      label: t.col.candidate,
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
    { key: "assessment", label: t.col.test, render: (r) => <span className="text-muted">{r.assessments?.title}</span> },
    {
      key: "status",
      label: t.col.status,
      render: (r) => {
        const trail = candidateTrail({ status: r.status, lastLoginAt: r.lastLoginAt });
        return (
        <div className="space-y-1.5">
        <span className="inline-flex items-center gap-2">
          <StatusBadge status={trail.neverSignedIn && r.status === "invited" ? "invited_pending" : r.status} labels={text.status} />
          {r.due_at && ["invited", "in_progress"].includes(r.status) && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${
                new Date(r.due_at).getTime() < nowMs()
                  ? "bg-critical-soft text-critical ring-critical/30"
                  : "bg-line-soft text-muted ring-line"
              }`}
            >
              {new Date(r.due_at).getTime() < nowMs() ? t.overdue : fillText(t.due, { date: new Date(r.due_at).toLocaleDateString(LOCALE[lang]) })}
            </span>
          )}
        </span>
        <ol className="flex items-center gap-1" aria-label={fillText(text.trail.progress, { step: trailCurrent(trail.currentIndex) })}>
          {trail.steps.map((st, i) => (
            <li key={st.label} title={text.trail.steps[i]} className={`h-1.5 w-5 rounded-full ${st.done ? "bg-good" : "bg-line"}`}>
              <span className="sr-only">
                {text.trail.steps[i]}: {st.done ? text.trail.done : text.trail.notYet}
              </span>
            </li>
          ))}
          <li className="ml-1.5 text-xs text-muted list-none" aria-hidden>
            {trailCurrent(trail.currentIndex)}
          </li>
        </ol>
        {r.decidedBy && (
          <p className="text-xs text-muted">
            {t.decidedBy} <span className="font-semibold text-foreground">{r.decidedBy}</span> · {relativeTimeText(lang, text.time, r.decidedAt)}
          </p>
        )}
        </div>
        );
      },
    },
    {
      key: "score",
      label: t.col.score,
      render: (r) => (r.overall_score !== null ? <ScoreBadge score={Math.round(r.overall_score)} /> : <span className="text-muted">—</span>),
    },
    {
      key: "flags",
      label: t.col.flags,
      render: (r) =>
        r.flags ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-warning">
            <Icon name="alertTriangle" className="w-4 h-4" />
            {pluralText(lang, r.flags, t.toCheck)}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "waiting",
      label: t.col.waiting,
      render: (r) =>
        r.submitted_at && ["submitted", "scored"].includes(r.status) ? (
          <span className="text-muted">{ageText(lang, text.time, r.submitted_at)}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) => {
        const email = r.candidate?.email;
        const waitingToSignIn = !!email && r.status === "invited" && candidateTrail({ status: r.status, lastLoginAt: r.lastLoginAt }).neverSignedIn;
        return (
          <div className="flex items-center justify-end gap-3">
            {waitingToSignIn && (
              <>
                <form action={resendCandidateInvite.bind(null, email)}>
                  <SubmitButton variant="ghost" size="sm" pendingLabel={t.sending}>
                    {t.resend}
                  </SubmitButton>
                </form>
                {canCopyLink && <CopyInviteLinkButton email={email} />}
              </>
            )}
            <Link
              href={`/staff/reports/candidates/${r.id}`}
              className="inline-flex items-center gap-1.5 text-accent-dark font-semibold whitespace-nowrap hover:underline"
            >
              {t.open}
              <Icon name="arrowRight" className="w-3.5 h-3.5" />
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-xs text-muted">{selected.size > 0 ? fillText(t.selected, { n: selected.size }) : pluralText(lang, rows.length, t.count)}</p>
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
                : "border-brand text-accent-dark hover:bg-brand-hover hover:text-on-primary"
            }`}
          >
            <Icon name="download" className="w-4 h-4" />
            {t.exportSelected}
          </a>
          <a
            href={exportBase}
            className={buttonClass({ size: "sm" })}
          >
            <Icon name="download" className="w-4 h-4" />
            {t.exportAll}
          </a>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        caption={t.caption}
        emptyMessage={t.empty}
      />
    </>
  );
}
