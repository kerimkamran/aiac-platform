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

async function sendInviteEmail(supabase: Awaited<ReturnType<typeof createClient>>, email: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://insight-azerconnect.vercel.app";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/invite/callback`,
  });
}

export async function addCandidate(formData: FormData) {
  const supabase = await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const department = String(formData.get("department") || "").trim() || null;

  if (!email || !fullName) {
    redirect("/staff/people?error=" + encodeURIComponent("Name and email are required."));
  }

  const { error } = await supabase.rpc("admin_provision_user", {
    p_email: email,
    p_full_name: fullName,
    p_role: "candidate",
    p_department: department,
  });

  if (error) {
    redirect("/staff/people?error=" + encodeURIComponent(error.message));
  }

  await sendInviteEmail(supabase, email);

  revalidatePath("/staff/people");
  redirect("/staff/people?added=" + encodeURIComponent(`${fullName} was added and invited by email.`));
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

  await sendInviteEmail(supabase, email);

  revalidatePath("/staff/people");
  redirect("/staff/people?added=" + encodeURIComponent(`${fullName} was added and invited by email.`));
}

export async function resendInvite(email: string) {
  "use server";
  const supabase = await requireAdmin();
  await sendInviteEmail(supabase, email);
  revalidatePath("/staff/people");
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
      await sendInviteEmail(supabase, email);
      added++;
    } else {
      skipped++;
    }
  }

  revalidatePath("/staff/people");

  const summary = `${added} added and invited, ${skipped} already existed${
    failed.length ? `, ${failed.length} failed (${failed.slice(0, 5).join("; ")}${failed.length > 5 ? "…" : ""})` : ""
  }.`;

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

  await sendInviteEmail(supabase, email);

  revalidatePath("/staff/people");
  redirect("/staff/people?added=" + encodeURIComponent(`${fullName} was added as ${role.replace(/_/g, " ")} and invited by email.`));
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
