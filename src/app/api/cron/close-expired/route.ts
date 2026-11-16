import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreAttempt } from "@/lib/score-attempt";
import { examDeadlineMs } from "@/lib/exam-time";

export const runtime = "nodejs";
export const maxDuration = 300;

const GRACE_MS = 5 * 60_000;
const BATCH = 10;

/** Closes attempts whose time ran out while the candidate was away (E-05).
 *
 *  An attempt still "in progress" five minutes after its deadline is submitted
 *  with the answers last saved on the server, marked late, and scored, so it
 *  does not sit open until the candidate happens to come back. Runs every 15
 *  minutes (Vercel Cron, see vercel.json), authorised with CRON_SECRET. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 501 });

  const { data: open, error } = await db
    .from("candidate_assessments")
    .select("id, started_at, extra_minutes, draft_answers, assessments(time_limit_minutes)")
    .eq("status", "in_progress")
    .not("started_at", "is", null)
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const expired = (open || [])
    .filter((r) => {
      const a = r.assessments as unknown as { time_limit_minutes: number } | null;
      return examDeadlineMs(r.started_at as string, a?.time_limit_minutes, r.extra_minutes as number | null) + GRACE_MS < now;
    })
    .slice(0, BATCH);

  let closed = 0;
  const failures: string[] = [];
  for (const r of expired) {
    // Only an attempt still in progress can be closed here.
    const { data: moved } = await db
      .from("candidate_assessments")
      .update({ status: "submitted", submitted_at: new Date().toISOString(), submitted_late: true })
      .eq("id", r.id)
      .eq("status", "in_progress")
      .select("id");
    if (!moved || moved.length === 0) continue;

    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries((r.draft_answers as Record<string, string> | null) ?? {})) answers[k] = String(v ?? "");
    const result = await scoreAttempt(db, { candidateAssessmentId: r.id as string, answers });
    if (result.ok) closed += 1;
    else failures.push(`${r.id}: ${result.error}`);
  }

  // Attempts that were submitted but never finished scoring (a failed run) are
  // finished here, ten minutes after submission.
  const { data: stuck } = await db
    .from("candidate_assessments")
    .select("id, draft_answers")
    .eq("status", "submitted")
    .lt("submitted_at", new Date(now - 10 * 60_000).toISOString())
    .limit(BATCH);
  let rescored = 0;
  for (const r of stuck || []) {
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries((r.draft_answers as Record<string, string> | null) ?? {})) answers[k] = String(v ?? "");
    const result = await scoreAttempt(db, { candidateAssessmentId: r.id as string, answers });
    if (result.ok) rescored += 1;
    else failures.push(`${r.id}: ${result.error}`);
  }

  return NextResponse.json({ checked: (open || []).length, expired: expired.length, closed, rescored, failures });
}
