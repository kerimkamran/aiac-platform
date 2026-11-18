import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type SessionProfile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  organization_id: string | null;
};

// The enterprise Admin Panel (/admin) is Super Admin only. Staff-level admin
// tools (People & Access, Settings) remain gated separately in the staff layout.
export { homeFor, safeNextPath } from "@/lib/home";

export const ADMIN_ROLES = ["system_admin"] as const;

// Mirrors the Postgres is_staff() helper used throughout RLS policies.
// Server Actions under src/app/staff/** should call requireStaff() as their
// first line: the /staff layout's role redirect only runs when a page is
// rendered/navigated to, not when a Server Action is invoked directly, so
// the action itself must independently re-check the caller's role.
export const STAFF_ROLES = ["recruiter", "hiring_manager", "hr_admin", "org_admin", "system_admin"] as const;

export async function requireStaff(): Promise<SessionProfile> {
  return requireRole(...STAFF_ROLES);
}

/** Load the signed-in user's profile, or null. */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, organization_id")
    .eq("id", user.id)
    .maybeSingle();
  return (data as SessionProfile) || null;
}

/** Throw unless the caller holds one of the given roles (and is active). */
export async function requireRole(...roles: string[]): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile || profile.status !== "active" || !roles.includes(profile.role)) {
    throw new Error("Not authorized");
  }
  return profile;
}

/**
 * Throw unless the caller holds the module/action permission
 * (role matrix + non-expired per-user overrides, evaluated in Postgres).
 */
export async function requirePermission(module: string, action: string): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile || profile.status !== "active") throw new Error("Not authorized");
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("has_perm", { p_module: module, p_action: action });
  if (!allowed) {
    await logAudit({ module, action, result: "denied" });
    throw new Error("Not authorized");
  }
  return profile;
}

export async function hasPermission(module: string, action: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_perm", { p_module: module, p_action: action });
  return !!data;
}

async function requestIp(): Promise<string | null> {
  try {
    const h = await headers();
    return (h.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  } catch {
    return null;
  }
}

export type AuditEntry = {
  module: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetUserId?: string;
  details?: Record<string, unknown>;
  result?: "success" | "denied" | "error";
};

async function callLogAdminEvent(entry: AuditEntry) {
  const supabase = await createClient();
  return supabase.rpc("log_admin_event", {
    p_module: entry.module,
    p_action: entry.action,
    p_target_type: entry.targetType ?? null,
    p_target_id: entry.targetId ?? null,
    p_details: entry.details ?? null,
    p_ip: await requestIp(),
    p_result: entry.result ?? "success",
    p_target_user_id: entry.targetUserId ?? null,
  });
}

/** Append-only audit write; never throws (auditing must not break the action).
 *  Always goes through the log_admin_event() RPC (security definer) rather
 *  than a direct table insert, so it isn't subject to RLS on the caller's
 *  own session. */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await callLogAdminEvent(entry);
  } catch {
    // swallow — audit failures must not block the underlying operation
  }
}

/** Same as logAudit, but fails closed: throws if the audit RPC itself
 *  fails. Use only where "no record, no action" is a deliberate security
 *  requirement (see /api/staff/invite-link — a sign-in link must never be
 *  created without a record of who made it). */
export async function logAuditOrThrow(entry: AuditEntry): Promise<void> {
  const { error } = await callLogAdminEvent(entry);
  if (error) throw error;
}

/** In-app notification; never throws. */
export async function notify(userId: string, title: string, body = "", link?: string): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("notify_user", { p_user_id: userId, p_title: title, p_body: body, p_link: link ?? null });
  } catch {}
}

/** Read a namespaced settings document (app_settings.value for key). */
export async function getSettings<T = Record<string, unknown>>(key: string): Promise<T | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? null;
}
