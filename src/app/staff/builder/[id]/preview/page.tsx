import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Icon } from "@/components/ui";
import { requireRole, STAFF_ROLES } from "@/lib/authz";

/** Read-only "exactly what the candidate sees" preview of an assessment,
 *  for builders to sanity-check before publishing. No timer, no proctoring,
 *  nothing is saved -- selecting options does nothing here. */
export default async function AssessmentPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const supabase = await createClient();

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, title, description, time_limit_minutes, status")
    .eq("id", id)
    .single();
  if (!assessment) notFound();

  const { data: sections } = await supabase
    .from("assessment_sections")
    .select("id, title, sequence, questions(id, question_type, prompt, options, sequence)")
    .eq("assessment_id", id)
    .order("sequence");

  type Q = { id: string; question_type: string; prompt: string; options: { key: string; text: string }[] | null; sequence: number };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-5">
        <Link
          href={`/staff/builder/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground font-medium"
        >
          <Icon name="arrowLeft" className="w-4 h-4" />
          Back to builder
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-dark bg-accent-soft px-3 py-1.5 rounded-full">
          <Icon name="eye" className="w-3.5 h-3.5" />
          Candidate preview — nothing is saved
        </span>
      </div>

      <Card className="p-8 mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-faint mb-2">Ready to begin</p>
        <h1 className="text-xl font-bold text-foreground mb-2">{assessment.title}</h1>
        {assessment.description && <p className="text-sm text-muted mb-4">{assessment.description}</p>}
        <span className="inline-flex items-center gap-1.5 text-xs text-muted font-semibold">
          <Icon name="timer" className="w-3.5 h-3.5" />
          {assessment.time_limit_minutes} minutes once started
        </span>
      </Card>

      {(sections || []).map((s, si) => {
        const qs = ((s.questions || []) as unknown as Q[]).sort((a, b) => a.sequence - b.sequence);
        return (
          <Card key={s.id} className="p-6 mb-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-faint mb-4">
              Section {si + 1} · {s.title}
            </p>
            <div className="space-y-6">
              {qs.map((q, qi) => (
                <div key={q.id}>
                  <p className="text-sm text-foreground mb-3">
                    <span className="text-faint font-semibold mr-1.5">{qi + 1}.</span>
                    {q.prompt}
                  </p>
                  {q.question_type === "mcq" && q.options ? (
                    <div className="space-y-2">
                      {q.options.map((o) => (
                        <div
                          key={o.key}
                          className="flex items-start gap-3 border border-line rounded-xl px-4 py-3 text-sm text-muted"
                        >
                          <span className="font-bold shrink-0">{o.key}</span>
                          <span>{o.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-dashed border-line rounded-xl px-4 py-6 text-xs text-faint">
                      Free-text answer box appears here
                    </div>
                  )}
                </div>
              ))}
              {qs.length === 0 && <p className="text-sm text-faint">No questions in this section yet.</p>}
            </div>
          </Card>
        );
      })}
      {(sections || []).length === 0 && (
        <Card className="p-8 text-center text-sm text-faint">No sections yet — add some in the builder first.</Card>
      )}
    </div>
  );
}
