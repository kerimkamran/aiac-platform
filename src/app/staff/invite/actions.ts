"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, STAFF_ROLES } from "@/lib/authz";
import { assignAssessment, provisionAccount, sendInvite } from "@/lib/invite";

// One result per person, so the last screen can say exactly what happened to
// each of them. "Sent" is only claimed when the email really went out.
export type PersonOutcome = "invited" | "added" | "already" | "failed" | "email_failed";
export type PersonResult = { email: string; name: string; outcome: PersonOutcome; message: string };
export type InviteResult = { ok: true; results: PersonResult[]; testTitle: string } | { ok: false; error: string };

export type InviteInput = {
  people: { name: string; email: string }[];
  assessmentId: string;
  // yyyy-mm-dd, optional
  dueDate?: string;
};

export const MAX_PEOPLE_PER_INVITE = 20;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function sendInvitations(input: InviteInput): Promise<InviteResult> {
  const me = await getSessionProfile();
  if (!me || me.status !== "active" || !(STAFF_ROLES as readonly string[]).includes(me.role)) {
    return { ok: false, error: "You don't have access to invite candidates." };
  }

  // Normalise and de-duplicate before anything is created.
  const seen = new Set<string>();
  const people: { name: string; email: string }[] = [];
  for (const p of input.people || []) {
    const email = String(p.email || "").trim().toLowerCase();
    const name = String(p.name || "").trim();
    if (!email && !name) continue;
    if (!name) return { ok: false, error: `Add a name for ${email}.` };
    if (!EMAIL_RE.test(email)) return { ok: false, error: `${email || name}: that email address doesn't look right.` };
    if (seen.has(email)) continue;
    seen.add(email);
    people.push({ name, email });
  }
  if (people.length === 0) return { ok: false, error: "Add at least one person." };
  if (people.length > MAX_PEOPLE_PER_INVITE) return { ok: false, error: `Invite at most ${MAX_PEOPLE_PER_INVITE} people at a time.` };

  const supabase = await createClient();
  const { data: test } = await supabase.from("assessments").select("id, title, status").eq("id", input.assessmentId).maybeSingle();
  if (!test || test.status !== "published") return { ok: false, error: "Choose a published test. Drafts can't be assigned." };

  let dueAt: string | null = null;
  if (input.dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return { ok: false, error: "The deadline date isn't valid." };
    const d = new Date(`${input.dueDate}T23:59:59Z`);
    if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) return { ok: false, error: "The deadline must be in the future." };
    dueAt = d.toISOString();
  }

  const results: PersonResult[] = [];
  for (const p of people) {
    const account = await provisionAccount(supabase, { email: p.email, fullName: p.name, role: "candidate" });
    if (!account.ok) {
      results.push({ ...p, outcome: "failed", message: account.error });
      continue;
    }

    if (!account.created) {
      const { data: existing } = await supabase.from("profiles").select("full_name, role").eq("id", account.id).maybeSingle();
      const who = (existing?.full_name as string) || p.name;
      if (existing && existing.role !== "candidate") {
        results.push({ ...p, outcome: "failed", message: `${who} already has a staff account with this email.` });
        continue;
      }
      const added = await assignAssessment(supabase, { candidateId: account.id, assessmentId: test.id as string, dueAt, title: test.title as string });
      if (typeof added === "object") results.push({ ...p, outcome: "failed", message: `${who} has an account, but the test couldn't be added: ${added.error}` });
      else if (added === "already_assigned") results.push({ ...p, outcome: "already", message: `${who} already has this test. Nothing was changed.` });
      else results.push({ ...p, outcome: "added", message: `${who} already has an account. The test was added and they were notified.` });
      continue;
    }

    const assigned = await assignAssessment(supabase, { candidateId: account.id, assessmentId: test.id as string, dueAt, title: test.title as string });
    if (typeof assigned === "object") {
      results.push({ ...p, outcome: "failed", message: `Account created, but the test couldn't be assigned: ${assigned.error}` });
      continue;
    }
    const mailError = await sendInvite(p.email);
    if (mailError) results.push({ ...p, outcome: "email_failed", message: `Account created and test assigned, but the email did not go out. ${mailError}` });
    else results.push({ ...p, outcome: "invited", message: "Invitation email sent." });
  }

  revalidatePath("/staff/people");
  revalidatePath("/staff/reports/candidates");
  return { ok: true, results, testTitle: test.title as string };
}
