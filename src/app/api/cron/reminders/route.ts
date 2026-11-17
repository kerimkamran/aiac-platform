import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, pickLang, reminderEmail, sendEmail } from "@/lib/email";

// The in-app reminder in the language of the test, like the email (language plan).
const dueSoon = {
  en: { title: (t: string) => `Due soon: ${t}`, body: (t: string, d: string) => `"${t}" is due on ${d}. Sign in to finish it.` },
  az: { title: (t: string) => `Tezliklə bitir: ${t}`, body: (t: string, d: string) => `“${t}” üçün son tarix ${d}. Tamamlamaq üçün daxil olun.` },
  ru: { title: (t: string) => `Скоро срок: ${t}`, body: (t: string, d: string) => `Срок для «${t}» — ${d}. Войдите, чтобы завершить.` },
} as const;

export const runtime = "nodejs";

/** Daily deadline-reminder job (Vercel Cron, see vercel.json).
 *
 *  Finds assigned assessments due within the next 3 days, not yet submitted
 *  and not yet reminded, and sends a real reminder naming the test and the due
 *  date, in the person's language (A-08). It used to resend a password-reset
 *  email, which is wrong. Only active candidates are reminded. Each person is
 *  reminded once per assignment (reminder_sent_at); a run sends at most 25.
 *
 *  The reminder always appears in the app. The email goes out when the company
 *  mail server is set up (SMTP_HOST, MAIL_FROM); without it, the in-app
 *  reminder is all that is sent. Failures are returned and logged.
 *
 *  Auth: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". */
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
    .select("id, due_at, candidate_id, assessments(title, content_language), candidate:profiles!candidate_assessments_candidate_id_fkey(email, full_name, status)")
    .in("status", ["invited", "in_progress"])
    .not("due_at", "is", null)
    .gt("due_at", now.toISOString())
    .lt("due_at", horizon.toISOString())
    .is("reminder_sent_at", null)
    .limit(25);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let emailed = 0;
  const failures: string[] = [];
  for (const row of due || []) {
    const candidate = row.candidate as unknown as { email: string; full_name: string; status: string } | null;
    const test = row.assessments as unknown as { title: string; content_language: string | null } | null;
    if (!candidate?.email || candidate.status !== "active" || !row.due_at) continue;

    const dueLabel = new Date(row.due_at as string).toLocaleDateString("en-GB");
    const title = test?.title || "your assessment";

    // In the app first, so the reminder exists even when email is not set up.
    const { error: noteError } = await admin.from("notifications").insert({
      user_id: row.candidate_id,
      title: dueSoon[pickLang(test?.content_language)].title(title),
      body: dueSoon[pickLang(test?.content_language)].body(title, dueLabel),
      link: "/candidate/assessments",
    });
    if (noteError) failures.push(`${candidate.email}: ${noteError.message}`);

    if (emailConfigured()) {
      const mail = reminderEmail({ lang: pickLang(test?.content_language), name: candidate.full_name || candidate.email, title, due: dueLabel });
      const mailError = await sendEmail({ to: candidate.email, ...mail });
      if (mailError) {
        console.error(`Reminder email to ${candidate.email} failed: ${mailError}`);
        failures.push(`${candidate.email}: ${mailError}`);
        continue; // leave reminder_sent_at null so the next run retries
      }
      emailed += 1;
    }

    await admin.from("candidate_assessments").update({ reminder_sent_at: now.toISOString() }).eq("id", row.id);
    sent += 1;
  }

  return NextResponse.json({ checked: (due || []).length, sent, emailed, failures });
}
