"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "hr_admin" && profile.role !== "system_admin")) {
    redirect("/staff?error=" + encodeURIComponent("Only HR admins and the super admin can manage people."));
  }
  return supabase;
}

// Returns a short, admin-facing reason when the invite email could not be
// queued (e.g. Supabase's shared default mailer rate limit), or null on
// success. Every caller must check this instead of assuming the email went
// out -- resetPasswordForEmail() can fail silently (rate limit, provider
// error) and previously that failure was dropped on the floor, so admins
// were told "invited by email" even when nothing was sent.
async function sendInviteEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string
): Promise<string | null> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://vantage-ag.vercel.app");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/invite/callback`,
  });
  return error ? error.message : null;
}

// Supabase returns two distinct, unrelated errors here and admins shouldn't
// have to know the difference: a per-email cooldown ("you can only request
// this after N seconds" -- a normal anti-spam throttle, not a failure) and
// a project-wide send-volume cap ("email rate limit exceeded"). Both have
// the same real fix available right now: "Copy invite link" generates the
// link directly and never touches the mailer, so it's unaffected by either.
function friendlyInviteError(raw: string): string {
  const cooldown = raw.match(/after (\d+) seconds?/i);
  if (cooldown) {
    return `Supabase's per-email cooldown is still active (wait ${cooldown[1]}s to resend by email) — or use "Copy invite link" now to skip the wait.`;
  }
  if (/rate limit/i.test(raw)) {
    return `Supabase's shared email sending limit is temporarily exhausted — use "Copy invite link" now instead of waiting it out.`;
  }
  return raw;
}

export async function addCandidate(formData: FormData) {
  const supabase = await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const department = String(formData.get("department") || "").trim() || null;
  // Assessment package is optional here: an admin can create a bare account
  // now and assign an assessment later (via the bulk "assign_assessment"
  // action further down this file), or pick one right away so the invite
  // email and the assessment assignment happen in a single step.
  const assessmentId = String(formData.get("assessment_id") || "").trim() || null;

  if (!email || !fullName) {
    redirect("/staff/people?error=" + encodeURIComponent("Name and email are required."));
  }

  const { data: provisioned, error } = await supabase.rpc("admin_provision_user", {
    p_email: email,
    p_full_name: fullName,
    p_role: "candidate",
    p_department: department,
  });

  if (error) {
    redirect("/staff/people?error=" + encodeURIComponent(error.message));
  }

  const candidateId = provisioned?.[0]?.profile_id as string | undefined;

  if (assessmentId && candidateId) {
    const { error: linkError } = await supabase.from("candidate_assessments").insert({
      assessment_id: assessmentId,
      candidate_id: candidateId,
      status: "invited",
    });
    // A duplicate link (candidate already assigned to this assessment) isn't
    // worth failing the whole invite over -- the account is still created
    // and the invite email still goes out below.
    if (linkError && !linkError.message.includes("duplicate")) {
      redirect("/staff/people?error=" + encodeURIComponent(`${fullName} was added, but couldn't be assigned the assessment: ${linkError.message}`));
    }
  }

  const inviteError = await sendInviteEmail(supabase, email);

  revalidatePath("/staff/people");
  revalidatePath("/staff/candidates");
  const assignedNote = assessmentId ? " and assigned their assessment" : "";
  redirect(
    inviteError
      ? "/staff/people?error=" +
          encodeURIComponent(`${fullName} was added${assignedNote}, but the invite email failed to send. ${friendlyInviteError(inviteError)}`)
      : "/staff/people?added=" + encodeURIComponent(`${fullName} was added${assignedNote} and invited by email.`)
  );
}

export async function addDecisionMaker(formData: FormData) {
  const supabase = await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();

  if (!email || !fullName) {
    redirect("/staff/people?error=" + encodeURIComponent("Name and email are required."));
  }

  const { error } = await supabase.rpc("admin_provision_user", {
    p_email: email,
    p_full_name: fullName,
    p_role: "decision_maker",
    p_department: null,
  });

  if (error) {
    redirect("/staff/people?error=" + encodeURIComponent(error.message));
  }

  const inviteError = await sendInviteEmail(supabase, email);

  revalidatePath("/staff/people");
  redirect(
    inviteError
      ? "/staff/people?error=" +
          encodeURIComponent(`${fullName} was added, but the invite email failed to send. ${friendlyInviteError(inviteError)}`)
      : "/staff/people?added=" + encodeURIComponent(`${fullName} was added and invited by email.`)
  );
}

export async function resendInvite(email: string) {
  "use server";
  const supabase = await requireAdmin();
  const inviteError = await sendInviteEmail(supabase, email);
  revalidatePath("/staff/people");
  redirect(
    inviteError
      ? "/staff/people?error=" + encodeURIComponent(friendlyInviteError(inviteError))
      : "/staff/people?added=" + encodeURIComponent("Invite email resent.")
  );
}

export async function assignDecisionMaker(candidateAssessmentId: string, formData: FormData) {
  const supabase = await requireAdmin();
  const profileId = String(formData.get("decision_maker_id") || "");
  if (!profileId) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("candidate_decision_makers").insert({
    candidate_assessment_id: candidateAssessmentId,
    profile_id: profileId,
    assigned_by: user!.id,
  });

  revalidatePath(`/staff/candidates/${candidateAssessmentId}`);
}

export async function unassignDecisionMaker(candidateAssessmentId: string, profileId: string) {
  "use server";
  const supabase = await requireAdmin();
  await supabase
    .from("candidate_decision_makers")
    .delete()
    .eq("candidate_assessment_id", candidateAssessmentId)
    .eq("profile_id", profileId);
  revalidatePath(`/staff/candidates/${candidateAssessmentId}`);
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  };

  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = cells[i] || "";
    });
    return row;
  });
}

export async function bulkAddCandidates(formData: FormData) {
  const supabase = await requireAdmin();
  const file = formData.get("csv") as File | null;

  if (!file || file.size === 0) {
    redirect("/staff/people?error=" + encodeURIComponent("Choose a CSV file first."));
  }

  const text = await file!.text();
  const rows = parseCsv(text);

  if (rows.length === 0) {
    redirect("/staff/people?error=" + encodeURIComponent("The CSV file has no data rows."));
  }

  let added = 0;
  let skipped = 0;
  const failed: string[] = [];
  const inviteFailed: string[] = [];

  for (const row of rows) {
    const email = (row.email || row["e-mail"] || "").trim().toLowerCase();
    const fullName = (row.full_name || row.name || row["full name"] || "").trim();
    const department = (row.department || row.structure || "").trim() || null;

    if (!email || !email.includes("@")) {
      failed.push(row.email || "(missing email)");
      continue;
    }

    const { data: provisioned, error } = await supabase.rpc("admin_provision_user", {
      p_email: email,
      p_full_name: fullName || email.split("@")[0],
      p_role: "candidate",
      p_department: department,
    });

    if (error) {
      failed.push(`${email} (${error.message})`);
      continue;
    }

    const wasCreated = provisioned?.[0]?.created as boolean | undefined;
    if (wasCreated) {
      const inviteError = await sendInviteEmail(supabase, email);
      if (inviteError) inviteFailed.push(email);
      added++;
    } else {
      skipped++;
    }
  }

  revalidatePath("/staff/people");

  const summary = `${added} added and invited, ${skipped} already existed${
    inviteFailed.length ? `, ${inviteFailed.length} invite email(s) failed to send (${inviteFailed.slice(0, 5).join(", ")}${inviteFailed.length > 5 ? "…" : ""}) — use "Resend invite"` : ""
  }${failed.length ? `, ${failed.length} failed (${failed.slice(0, 5).join("; ")}${failed.length > 5 ? "…" : ""})` : ""}.`;

  redirect("/staff/people?added=" + encodeURIComponent(summary));
}

/* ---------------- Advanced user management ---------------- */

const STAFF_ROLES = ["recruiter", "hiring_manager", "hr_admin", "system_admin"] as const;
const ALL_ROLES = ["candidate", "decision_maker", ...STAFF_ROLES] as const;

export async function addStaffMember(formData: FormData) {
  const supabase = await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role") || "");
  const department = String(formData.get("department") || "").trim() || null;

  if (!email || !fullName) {
    redirect("/staff/people?error=" + encodeURIComponent("Name and email are required."));
  }
  if (!(STAFF_ROLES as readonly string[]).includes(role)) {
    redirect("/staff/people?error=" + encodeURIComponent("Choose a valid role."));
  }

  const { error } = await supabase.rpc("admin_provision_user", {
    p_email: email,
    p_full_name: fullName,
    p_role: role,
    p_department: department,
  });

  if (error) {
    redirect("/staff/people?error=" + encodeURIComponent(error.message));
  }

  const inviteError = await sendInviteEmail(supabase, email);

  revalidatePath("/staff/people");
  redirect(
    inviteError
      ? "/staff/people?error=" +
          encodeURIComponent(`${fullName} was added, but the invite email failed to send. ${friendlyInviteError(inviteError)}`)
      : "/staff/people?added=" + encodeURIComponent(`${fullName} was added as ${role.replace(/_/g, " ")} and invited by email.`)
  );
}

export async function updateUserRole(formData: FormData) {
  const supabase = await requireAdmin();
  const userId = String(formData.get("user_id") || "");
  const role = String(formData.get("role") || "");
  const department = String(formData.get("department") || "").trim();

  if (!userId || !(ALL_ROLES as readonly string[]).includes(role)) {
    redirect("/staff/people?error=" + encodeURIComponent("Invalid role update."));
  }

  const { error } = await supabase.rpc("admin_update_user_role", {
    p_user_id: userId,
    p_role: role,
    p_department: department || null,
  });

  if (error) {
    redirect("/staff/people?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/staff/people");
  redirect("/staff/people?added=" + encodeURIComponent("User updated."));
}

export async function setUserStatus(userId: string, status: "active" | "deactivated") {
  "use server";
  const supabase = await requireAdmin();

  const { error } = await supabase.rpc("admin_set_user_status", { p_user_id: userId, p_status: status });

  if (error) {
    redirect("/staff/people?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/staff/people");
  redirect(
    "/staff/people?added=" + encodeURIComponent(status === "deactivated" ? "User deactivated." : "User reactivated.")
  );
}

type BulkAction = "set_role" | "activate" | "deactivate" | "resend_invite" | "assign_assessment";

export async function bulkPeopleAction(formData: FormData) {
  const supabase = await requireAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const action = String(formData.get("bulk_action") || "") as BulkAction;
  const bulkRole = String(formData.get("bulk_role") || "");
  const bulkAssessmentId = String(formData.get("bulk_assessment_id") || "");
  const userIds = formData
    .getAll("user_ids")
    .map((v) => String(v))
    .filter((id) => id && id !== user?.id);

  if (userIds.length === 0) {
    redirect("/staff/people?error=" + encodeURIComponent("Select at least one person first."));
  }

  if (!["set_role", "activate", "deactivate", "resend_invite", "assign_assessment"].includes(action)) {
    redirect("/staff/people?error=" + encodeURIComponent("Choose a bulk action."));
  }

  if (action === "set_role" && !(ALL_ROLES as readonly string[]).includes(bulkRole)) {
    redirect("/staff/people?error=" + encodeURIComponent("Choose a valid role for the bulk update."));
  }

  if (action === "assign_assessment" && !bulkAssessmentId) {
    redirect("/staff/people?error=" + encodeURIComponent("Choose an assessment to assign."));
  }

  let currentDepartments = new Map<string, string | null>();
  if (action === "set_role") {
    const { data: rows } = await supabase.from("profiles").select("id, department").in("id", userIds);
    currentDepartments = new Map((rows || []).map((r) => [r.id, r.department as string | null]));
  }

  let assessmentTitle = "an assessment";
  if (action === "assign_assessment") {
    const { data: assessment } = await supabase.from("assessments").select("title").eq("id", bulkAssessmentId).single();
    if (assessment?.title) assessmentTitle = assessment.title;
  }

  let succeeded = 0;
  let failed = 0;

  for (const id of userIds) {
    try {
      if (action === "set_role") {
        const { error } = await supabase.rpc("admin_update_user_role", {
          p_user_id: id,
          p_role: bulkRole,
          p_department: currentDepartments.get(id) || null,
        });
        if (error) throw error;
      } else if (action === "activate" || action === "deactivate") {
        const { error } = await supabase.rpc("admin_set_user_status", {
          p_user_id: id,
          p_status: action === "activate" ? "active" : "deactivated",
        });
        if (error) throw error;
      } else if (action === "resend_invite") {
        const { data: row } = await supabase.from("profiles").select("email").eq("id", id).single();
        if (!row?.email) throw new Error("No email on file.");
        const inviteError = await sendInviteEmail(supabase, row.email);
        if (inviteError) throw new Error(inviteError);
      } else if (action === "assign_assessment") {
        const { error } = await supabase
          .from("candidate_assessments")
          .insert({ assessment_id: bulkAssessmentId, candidate_id: id, status: "invited" });
        if (error) {
          if (!error.message.includes("duplicate")) throw error;
          // Already assigned -- count it a no-op success, but don't re-notify.
        } else {
          await supabase.from("notifications").insert({
            user_id: id,
            title: "New assessment assigned",
            body: `You've been assigned "${assessmentTitle}". Log in to take it.`,
            link: "/candidate/assessments",
          });
        }
      }
      succeeded++;
    } catch {
      failed++;
    }
  }

  revalidatePath("/staff/people");

  const actionLabel =
    action === "set_role"
      ? `role changed to ${bulkRole.replace(/_/g, " ")}`
      : action === "activate"
        ? "activated"
        : action === "deactivate"
          ? "deactivated"
          : action === "assign_assessment"
            ? `assigned "${assessmentTitle}"`
            : "re-invited";

  const summary =
    failed === 0
      ? `${succeeded} ${succeeded === 1 ? "person" : "people"} ${actionLabel}.`
      : `${succeeded} ${actionLabel}, ${failed} failed.`;

  redirect("/staff/people?added=" + encodeURIComponent(summary));
}
