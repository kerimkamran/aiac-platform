import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FocusDeck } from "@/components/horizon/FocusDeck";
import { StatusBadge, ScoreBadge } from "@/components/ui";
import { ButtonLink } from "@/components/ui/Button";
import { ageLabel } from "@/lib/dates";

export const metadata = { title: "Review mode" };

type Row = {
  id: string;
  overall_score: number | null;
  submitted_at: string | null;
  candidate: { full_name: string; email: string } | null;
  assessments: { title: string; vacancy_title: string | null } | null;
};

// Review mode: the waiting reviews as a deck, oldest first, one at a time. The
// position lives in the URL (?i=), so a refresh or a shared link lands in the
// same place. The deck is capped, which keeps the page cheap.
const DECK_MAX = 100;

export default async function ReviewModePage({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const { i } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidate_assessments")
    .select(
      "id, overall_score, submitted_at, candidate:profiles!candidate_assessments_candidate_id_fkey(full_name, email), assessments(title, vacancy_title)"
    )
    .eq("status", "scored")
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .limit(DECK_MAX);
  const rows = (data || []) as unknown as Row[];

  if (rows.length === 0) {
    return (
      <div className="container-page max-w-3xl py-16">
        <h1 className="text-display text-foreground">You&apos;re all caught up.</h1>
        <p className="mt-3 text-body-large text-muted">Nothing is waiting for review.</p>
        <div className="mt-7">
          <ButtonLink href="/staff" variant="secondary" size="lg">
            Back to home
          </ButtonLink>
        </div>
      </div>
    );
  }

  const n = Number.parseInt(i ?? "0", 10);
  const index = Number.isFinite(n) ? Math.min(Math.max(n, 0), rows.length - 1) : 0;
  const row = rows[index];
  const href = (k: number) => `/staff/review?i=${k}`;

  return (
    <div className="container-page max-w-3xl py-8 lg:py-12">
      <Link href="/staff" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
        ← Home
      </Link>
      <h1 className="mt-2 mb-6 text-display text-foreground">Review mode</h1>
      <FocusDeck
        index={index}
        total={rows.length}
        title={row.candidate?.full_name || "Candidate"}
        meta={`${row.assessments?.vacancy_title || row.assessments?.title || ""}${row.submitted_at ? ` · waiting ${ageLabel(row.submitted_at)}` : ""}`}
        openHref={`/staff/reports/candidates/${row.id}`}
        prevHref={index > 0 ? href(index - 1) : undefined}
        nextHref={index < rows.length - 1 ? href(index + 1) : undefined}
      >
        <div className="flex items-center gap-3">
          <StatusBadge status="scored" />
          {row.overall_score !== null && (
            <span className="text-base text-muted">
              Draft score <ScoreBadge score={Math.round(row.overall_score)} />
            </span>
          )}
        </div>
      </FocusDeck>
    </div>
  );
}
