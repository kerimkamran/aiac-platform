"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, logAudit, notify } from "@/lib/authz";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

/* ---------------- Users ---------------- */

export async function updateUserProfile(userId: string, formData: FormData) {
  await requirePermission("users", "update");
  const supabase = await createClient();

  const custom: Record<string, string> = {};
  const customRaw = str(formData, "custom_fields");
  if (customRaw) {
    for (const line of customRaw.split("\n")) {
      const [k, ...rest] = line.split(":");
      if (k?.trim() && rest.length) custom[k.trim()] = rest.join(":").trim();
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: str(formData, "full_name"),
      phone: str(formData, "phone") || null,
      job_title: str(formData, "job_title") || null,
      department: str(formData, "department") || null,
      business_unit: str(formData, "business_unit") || null,
      location: str(formData, "location") || null,
      manager_id: str(formData, "manager_id") || null,
      org_unit_id: str(formData, "org_unit_id") || null,
      is_employee: formData.get("is_employee") === "on",
      employee_id: str(formData, "employee_id") || null,
      hire_date: str(formData, "hire_date") || null,
      expertise: str(formData, "expertise") ? str(formData, "expertise").split(",").map((s) => s.trim()).filter(Boolean) : null,
      availability: str(formData, "availability") || "available",
      max_workload: Number(formData.get("max_workload") || 5),
      custom_fields: custom,
    })
    .eq("id", userId);

  await logAudit({ module: "users", action: "profile_updated", targetType: "user", targetId: userId, result: error ? "error" : "success" });
  if (error) redirect(`/admin/users/${userId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users/${userId}?ok=${encodeURIComponent("Profile saved")}`);
}

export async function setUserStatus(userId: string, status: string) {
  await requirePermission("users", "update");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_status", { p_user_id: userId, p_status: status });
  if (error) redirect(`/admin/users/${userId}?error=${encodeURIComponent(error.message)}`);
  await notify(userId, "Account status changed", `Your AIAC account is now ${status}.`);
  revalidatePath(`/admin/users/${userId}`);
}

export async function toggleUserFlag(userId: string, flag: "blacklisted" | "legal_hold", value: boolean) {
  await requirePermission(flag === "legal_hold" ? "data" : "candidates", "update");
  const supabase = await createClient();
  await supabase.from("profiles").update({ [flag]: value }).eq("id", userId);
  await logAudit({ module: flag === "legal_hold" ? "data" : "candidates", action: `${flag}_${value ? "set" : "cleared"}`, targetType: "user", targetId: userId });
  revalidatePath(`/admin/users/${userId}`);
}

export async function anonymizeUser(userId: string) {
  await requirePermission("data", "delete");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_anonymize_user", { p_user_id: userId });
  if (error) redirect(`/admin/users/${userId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users/${userId}?ok=${encodeURIComponent("User anonymized (GDPR)")}`);
}

export async function addPermissionOverride(userId: string, formData: FormData) {
  const admin = await requirePermission("roles", "update");
  const supabase = await createClient();
  const permissionId = Number(formData.get("permission_id"));
  const expires = str(formData, "expires_at");
  await supabase.from("user_permission_overrides").insert({
    user_id: userId,
    permission_id: permissionId,
    granted: formData.get("granted") !== "deny",
    expires_at: expires || null,
    created_by: admin.id,
  });
  await logAudit({ module: "roles", action: "override_added", targetType: "user", targetId: userId, details: { permissionId, expires } });
  revalidatePath(`/admin/users/${userId}`);
}

export async function removePermissionOverride(userId: string, overrideId: string) {
  await requirePermission("roles", "update");
  const supabase = await createClient();
  await supabase.from("user_permission_overrides").delete().eq("id", overrideId);
  await logAudit({ module: "roles", action: "override_removed", targetType: "user", targetId: userId, details: { overrideId } });
  revalidatePath(`/admin/users/${userId}`);
}

/* ---------------- Roles matrix ---------------- */

export async function saveRoleMatrix(formData: FormData) {
  await requirePermission("roles", "update");
  const supabase = await createClient();
  const role = str(formData, "role");
  const granted = formData.getAll("perm").map(Number);

  const { data: allPerms } = await supabase.from("permissions").select("id");
  const all = (allPerms || []).map((p) => p.id as number);

  await supabase.from("role_permissions").delete().eq("role", role).in("permission_id", all);
  if (granted.length > 0) {
    await supabase.from("role_permissions").insert(granted.map((id) => ({ role, permission_id: id })));
  }
  await logAudit({ module: "roles", action: "matrix_updated", targetType: "role", targetId: role, details: { grantedCount: granted.length } });
  revalidatePath("/admin/roles");
  redirect(`/admin/roles?ok=${encodeURIComponent(`Permissions saved for ${role}`)}`);
}

/* ---------------- Org units ---------------- */

export async function addOrgUnit(formData: FormData) {
  await requirePermission("organizations", "update");
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).maybeSingle();
  await supabase.from("org_units").insert({
    organization_id: org?.id ?? null,
    parent_id: str(formData, "parent_id") || null,
    unit_type: str(formData, "unit_type"),
    name: str(formData, "name"),
  });
  await logAudit({ module: "organizations", action: "unit_added", details: { name: str(formData, "name"), type: str(formData, "unit_type") } });
  revalidatePath("/admin/organizations");
}

export async function deleteOrgUnit(unitId: string) {
  await requirePermission("organizations", "update");
  const supabase = await createClient();
  await supabase.from("org_units").delete().eq("id", unitId);
  await logAudit({ module: "organizations", action: "unit_deleted", targetType: "org_unit", targetId: unitId });
  revalidatePath("/admin/organizations");
}

/* ---------------- Approvals ---------------- */

export async function createApprovalRequest(formData: FormData) {
  const requester = await requirePermission("users", "view");
  const supabase = await createClient();
  const type = str(formData, "request_type");
  const payload = {
    email: str(formData, "email"),
    full_name: str(formData, "full_name"),
    role: str(formData, "role"),
    note: str(formData, "note"),
  };
  await supabase.from("approval_requests").insert({ request_type: type, payload, requested_by: requester.id });
  await logAudit({ module: "users", action: "approval_requested", details: { type, ...payload } });
  revalidatePath("/admin/approvals");
  redirect(`/admin/approvals?ok=${encodeURIComponent("Request submitted for approval")}`);
}

export async function decideApproval(requestId: string, decision: "approved" | "rejected", formData: FormData) {
  const approver = await requirePermission("users", "approve");
  const supabase = await createClient();

  const { data: req } = await supabase.from("approval_requests").select("*").eq("id", requestId).single();
  if (!req || req.status !== "pending") redirect("/admin/approvals?error=" + encodeURIComponent("Request not found or already decided"));

  if (decision === "approved") {
    const p = req.payload as { email?: string; full_name?: string; role?: string };
    if (req.request_type === "user_create" && p.email) {
      const { error } = await supabase.rpc("admin_provision_user", {
        p_email: p.email,
        p_full_name: p.full_name || p.email,
        p_role: p.role || "candidate",
        p_department: null,
      });
      if (error) redirect("/admin/approvals?error=" + encodeURIComponent(error.message));
    }
    if (req.request_type === "role_change" && p.email && p.role) {
      const { data: target } = await supabase.from("profiles").select("id").eq("email", p.email).maybeSingle();
      if (target) {
        const { error } = await supabase.rpc("admin_update_user_role", { p_user_id: target.id, p_role: p.role, p_department: null });
        if (error) redirect("/admin/approvals?error=" + encodeURIComponent(error.message));
      }
    }
  }

  await supabase
    .from("approval_requests")
    .update({ status: decision, decided_by: approver.id, decided_at: new Date().toISOString(), comment: str(formData, "comment") || null })
    .eq("id", requestId);

  await logAudit({ module: "users", action: `approval_${decision}`, targetType: "approval_request", targetId: requestId, details: { type: req.request_type } });
  await notify(req.requested_by, `Request ${decision}`, `Your ${req.request_type.replace(/_/g, " ")} request was ${decision}.`, "/admin/approvals");
  revalidatePath("/admin/approvals");
}

/* ---------------- Settings ---------------- */

export async function saveSettings(key: string, formData: FormData) {
  const admin = await requirePermission("settings", "update");
  const supabase = await createClient();

  let value: Record<string, unknown> = {};
  if (key === "security") {
    value = {
      session_timeout_minutes: Number(formData.get("session_timeout_minutes") || 480),
      ip_allowlist: str(formData, "ip_allowlist").split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
      mfa_required_roles: formData.getAll("mfa_required_roles").map(String),
    };
  } else if (key === "ai") {
    value = {
      scoring_enabled: formData.get("scoring_enabled") === "on",
      allowed_roles: formData.getAll("allowed_roles").map(String),
      monthly_quota: Number(formData.get("monthly_quota") || 1000),
      model: str(formData, "model") || "claude",
    };
  } else if (key === "data_governance") {
    value = {
      retention_days: Number(formData.get("retention_days") || 730),
      auto_anonymize: formData.get("auto_anonymize") === "on",
    };
  }

  await supabase.from("app_settings").upsert({ key, value, updated_by: admin.id, updated_at: new Date().toISOString() });
  await logAudit({ module: "settings", action: "updated", targetType: "settings", targetId: key, details: value });
  revalidatePath(`/admin/${key === "data_governance" ? "data-governance" : key === "ai" ? "ai-governance" : "security"}`);
}

/* ---------------- Notifications ---------------- */

export async function broadcastNotification(formData: FormData) {
  await requirePermission("notifications", "create");
  const supabase = await createClient();
  const title = str(formData, "title");
  const body = str(formData, "body");
  const audience = str(formData, "audience"); // all | staff | candidates

  let query = supabase.from("profiles").select("id").eq("status", "active");
  if (audience === "staff") query = query.neq("role", "candidate");
  if (audience === "candidates") query = query.eq("role", "candidate");
  const { data: targets } = await query;

  if (targets && targets.length > 0) {
    await supabase.from("notifications").insert(targets.map((t) => ({ user_id: t.id, title, body })));
  }
  await logAudit({ module: "notifications", action: "broadcast", details: { audience, count: targets?.length ?? 0, title } });
  revalidatePath("/admin/notifications");
  redirect(`/admin/notifications?ok=${encodeURIComponent(`Sent to ${targets?.length ?? 0} user(s)`)}`);
}

export async function markNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
}
