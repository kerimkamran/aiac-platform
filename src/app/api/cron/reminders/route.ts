import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Daily deadline-reminder job (Vercel Cron, see vercel.json).
 *
 *  Finds assigned assessments that are due within the next 3 days, still
 *  not submitted, and not yet reminded, and re-sends the invite email (the
 *  same Supabase auth mailer the "Resend invite" button uses -- the only
 *  mailer configured in this stack). Each person is reminded at most once
 *  per assignment (reminder_sent_at), and each run caps at 10 sends to
 *  stay well under Supabase's shared mailer rate limits; anything left
 *  over is picked up by the next daily run.
 *
 *  Auth: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when the
 *  CRON_SECRET env var is set. Requests without it are rejected. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 501 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const { data: due, error } = await admin
    .from("candidate_assessments")
    .select("id, due_at, candidate:profiles!candidate_assessments_candidate_id_fkey(email, full_name)")
    .in("status", ["invited", "in_progress"])
    .not("due_at", "is", null)
    .gt("due_at", now.toISOString())
    .lt("due_at", horizon.toISOString())
    .is("reminder_sent_at", null)
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://vantage-ag.vercel.app");

  let sent = 0;
  const failures: string[] = [];
  for (const row of due || []) {
    const candidate = row.candidate as unknown as { email: string; full_name: string } | null;
    if (!candidate?.email) continue;

    const { error: mailError } = await admin.auth.resetPasswordForEmail(candidate.email, {
      redirectTo: `${site}/invite/callback`,
    });

    if (mailError) {
      failures.push(`${candidate.email}: ${mailError.message}`);
      continue; // leave reminder_sent_at null so the next run retries
    }

    await admin.from("candidate_assessments").update({ reminder_sent_at: now.toISOString() }).eq("id", row.id);
    sent += 1;
  }

  return NextResponse.json({ checked: (due || []).length, sent, failures });
}
