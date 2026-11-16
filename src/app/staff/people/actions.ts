"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assignAssessment, provisionAccount, sendInvite } from "@/lib/invite";
import { STAFF_ROLES as ALL_STAFF_ROLES } from "@/lib/authz";
import { parseCsv } from "@/lib/csv";

async function currentRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", user.id).single();
  return { supabase, user, role: profile?.status === "active" ? (profile.role as string) : null };
}

// People management (staff, roles, status) stays with HR admins and the super admin.
async function requireAdmin() {
  const { supabase, role } = await currentRole();
  if (role !== "hr_admin" && role !== "system_admin") {
    redirect("/staff?error=" + encodeURIComponent("Only HR admins and the Super Admin can manage people."));
  }
  return supabase;
}

// Inviting candidates is open to every active staff member (recruiters and
// hiring managers included). It can never create staff or change roles.
async function requireInviter() {
  const { supabase, role } = await currentRole();
  if (!role || !(ALL_STAFF_ROLES as readonly string[]).includes(role)) {
    redirect("/staff?error=" + encodeURIComponent("You don't have access to invite candidates."));
  }
  return supabase;
}

export async function addCandidate(formData: FormData) {
  const supabase = await requireInviter();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const department = String(formData.get("department") || "").trim() || null;
  const assessmentId = String(formData.get("assessment_id") || "").trim() || null;
  // The invite page is open to every staff role; People is for admins only.
  const base = String(formData.get("return_to") || "") === "invite" ? "/staff/invite" : "/staff/people";
  const to = (kind: "error" | "added", message: string) => `${base}?${kind}=${encodeURIComponent(message)}`;

  if (!email || !fullName) redirect(to("error", "Name and email are required."));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect(to("error", "That email address doesn't look right."));

  let assessmentTitle = "";
  if (assessmentId) {
    const { data: target } = await supabase.from("assessments").select("status, title").eq("id", assessmentId).maybeSingle();
    if (!target || target.status !== "published") {
      redirect(to("error", "Publish the assessment before assigning it to a candidate."));
    }
    assessmentTitle = target.title as string;
  }

  const account = await provisionAccount(supabase, { email, fullName, role: "candidate", department });
  if (!account.ok) redirect(to("error", account.error));

  const dueDateRaw = String(formData.get("due_date") || "").trim();
  const dueAt = dueDateRaw ? new Date(`${dueDateRaw}T23:59:59Z`).toISOString() : null;

  // Somebody who already has an account is named, never silently skipped.
  if (!account.created) {
    const { data: existing } = await supabase.from("profiles").select("full_name, role").eq("id", account.id).maybeSingle();
    const who = existing?.full_name || email;
    if (existing && existing.role !== "candidate") {
      redirect(to("error", `${who} already has a staff account with this email.`));
    }
    if (!assessmentId) {
      redirect(to("error", `${who} already has an account. Choose an assessment to add it to their account.`));
    }
    const added = await assignAssessment(supabase, { candidateId: account.id, assessmentId: assessmentId!, dueAt, title: assessmentTitle });
    revalidatePath("/staff/people");
    revalidatePath("/staff/reports/candidates");
    if (typeof added === "object") redirect(to("error", `${who} already has an account, but the assessment couldn't be added: ${added.error}`));
    redirect(
      to(
        "added",
        added === "already_assigned"
          ? `${who} already has an account and this assessment. Nothing was changed.`
          : `${who} already has an account. The assessment was added to it and they were notified.`
      )
    );
  }

  let assignNote = "";
  if (assessmentId) {
    const assigned = await assignAssessment(supabase, { candidateId: account.id, assessmentId, dueAt, title: assessmentTitle });
    if (typeof assigned === "object") {
      redirect(to("error", `${fullName} was added, but couldn't be assigned the assessment: ${assigned.error}`));
    }
    assignNote = " and assigned their assessment";
  }

  const inviteError = await sendInvite(email);

  revalidatePath("/staff/people");
  revalidatePath("/staff/reports/candidates");
  redirect(
    inviteError
      ? to("error", `${fullName} was added${assignNote}, but the invite email didn't go out. ${inviteError}`)
      : to("added", `${fullName} was added${assignNote} and invited by email.`)
  );
}

export async function resendInvite(email: string) {
  "use server";
  const supabase = await requireInviter();
  // Staff accounts are re-invited by admins only.
  const { data: target } = await supabase.from("profiles").select("role").eq("email", email.trim().toLowerCase()).maybeSingle();
  if (target && target.role !== "candidate") await requireAdmin();
  const inviteError = await sendInvite(email);
  revalidatePath("/staff/people");
  redirect(
    inviteError
      ? "/staff/people?error=" + encodeURIComponent(inviteError)
      : "/staff/people?added=" + encodeURIComponent("Invite email resent.")
  );
}

function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.toLowerCase());
  return rows.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = cells[i] || "";
    });
    return row;
  });
}

export async function bulkAddCandidates(formData: FormData) {
  const supabase = await requireInviter();
  const file = formData.get("csv") as File | null;

  if (!file || file.size === 0) {
    redirect("/staff/people?error=" + encodeURIComponent("Choose a CSV file first."));
  }

  const text = await file!.text();
  const rows = parseCsvRecords(text);

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
      failed.push(`${row.email || row["e-mail"] || "(blank)"} (not a valid email address)`);
      continue;
    }

    const account = await provisionAccount(supabase, {
      email,
      fullName: fullName || email.split("@")[0],
      role: "candidate",
      department,
    });

    if (!account.ok) {
      failed.push(`${email} (${account.error})`);
      continue;
    }

    if (account.created) {
      const inviteError = await sendInvite(email);
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
const ALL_ROLES = ["candidate", ...STAFF_ROLES] as const;

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

  const account = await provisionAccount(supabase, { email, fullName, role, department });
  if (!account.ok) redirect("/staff/people?error=" + encodeURIComponent(account.error));
  if (!account.created) {
    redirect("/staff/people?error=" + encodeURIComponent(`${email} already has an account. Change their role from the list instead.`));
  }

  const inviteError = await sendInvite(email);

  revalidatePath("/staff/people");
  redirect(
    inviteError
      ? "/staff/people?error=" + encodeURIComponent(`${fullName} was added, but the invite email didn't go out. ${inviteError}`)
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

  if (action === "assign_assessment" && bulkAssessmentId) {
    const { data: target } = await supabase.from("assessments").select("status").eq("id", bulkAssessmentId).maybeSingle();
    if (!target || target.status !== "published") {
      redirect("/staff/people?error=" + encodeURIComponent("Publish the assessment before assigning it."));
    }
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
        const inviteError = await sendInvite(row.email);
        if (inviteError) throw new Error(inviteError);
      } else if (action === "assign_assessment") {
        const result = await assignAssessment(supabase, { candidateId: id, assessmentId: bulkAssessmentId, title: assessmentTitle });
        if (typeof result === "object") throw new Error(result.error);
        // "already_assigned" counts as done, and nobody is notified twice.
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
