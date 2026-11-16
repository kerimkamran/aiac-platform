import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSetPasswordEmail } from "@/lib/supabase/mailer";
import { assignmentEmail, emailConfigured, pickLang, sendEmail } from "@/lib/email";

/**
 * One way to invite or assign, used by People, the builder, the approvals
 * screen and the API, so the same rules (and the same messages) apply
 * everywhere:
 *  - a new person gets an account and an email with a link to set a password;
 *  - a person who already has an account is named, never silently skipped;
 *  - assigning a test tells the person in the app, and never twice.
 */

export type ProvisionResult =
  | { ok: true; id: string; created: boolean }
  | { ok: false; error: string };

export async function provisionAccount(
  supabase: SupabaseClient,
  input: { email: string; fullName: string; role: string; department?: string | null }
): Promise<ProvisionResult> {
  const { data, error } = await supabase.rpc("admin_provision_user", {
    p_email: input.email,
    p_full_name: input.fullName,
    p_role: input.role,
    p_department: input.department ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const row = (data as { profile_id: string; created: boolean }[] | null)?.[0];
  if (!row?.profile_id) return { ok: false, error: "The account could not be created." };
  return { ok: true, id: row.profile_id, created: row.created };
}

export type AssignResult = "assigned" | "already_assigned" | { error: string };

export async function assignAssessment(
  supabase: SupabaseClient,
  input: { candidateId: string; assessmentId: string; dueAt?: string | null; title?: string }
): Promise<AssignResult> {
  const { error } = await supabase.from("candidate_assessments").insert({
    assessment_id: input.assessmentId,
    candidate_id: input.candidateId,
    status: "invited",
    due_at: input.dueAt ?? null,
  });
  if (error) {
    if (error.code === "23505" || /duplicate/i.test(error.message)) return "already_assigned";
    return { error: error.message };
  }
  await supabase.rpc("notify_user", {
    p_user_id: input.candidateId,
    p_title: "New assessment assigned",
    p_body: `You've been assigned "${input.title || "an assessment"}". Sign in to take it.`,
    p_link: "/candidate/assessments",
  });
  // An email too, when the company mail server is set up. Best effort: the
  // in-app notice above is always sent.
  if (emailConfigured()) {
    const { data: person } = await supabase.from("profiles").select("email, full_name").eq("id", input.candidateId).maybeSingle();
    const { data: test } = await supabase.from("assessments").select("content_language").eq("id", input.assessmentId).maybeSingle();
    if (person?.email) {
      const due = input.dueAt ? new Date(input.dueAt).toLocaleDateString("en-GB") : null;
      const mail = assignmentEmail({
        lang: pickLang((test as { content_language?: string | null } | null)?.content_language),
        name: (person.full_name as string) || (person.email as string),
        title: input.title || "an assessment",
        due,
      });
      await sendEmail({ to: person.email as string, ...mail });
    }
  }
  return "assigned";
}

/** Sends the set-password email. Returns null on success or a plain message. */
export async function sendInvite(email: string): Promise<string | null> {
  const raw = await sendSetPasswordEmail(email);
  return raw ? friendlyInviteError(raw) : null;
}

export function friendlyInviteError(raw: string): string {
  const cooldown = raw.match(/after (\d+) seconds?/i);
  if (cooldown) return `A link was sent a moment ago. Wait ${cooldown[1]} seconds to send another, or use "Copy invite link".`;
  if (/rate limit/i.test(raw)) return `The email limit was reached. Use "Copy invite link" instead of waiting.`;
  return raw;
}
