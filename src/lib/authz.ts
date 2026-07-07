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
export const ADMIN_ROLES = ["system_admin"] as const;

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
  details?: Record<string, unknown>;
  result?: "success" | "denied" | "error";
};

/** Append-only audit write; never throws (auditing must not break the action). */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("log_admin_event", {
      p_module: entry.module,
      p_action: entry.action,
      p_target_type: entry.targetType ?? null,
      p_target_id: entry.targetId ?? null,
      p_details: entry.details ?? null,
      p_ip: await requestIp(),
      p_result: entry.result ?? "success",
    });
  } catch {
    // swallow — audit failures must not block the underlying operation
  }
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
