import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const NO_STORE = { "Cache-Control": "no-store" };

/** Directly sets a user's password via the Auth Admin API -- no email,
 *  no link, takes effect immediately. For cases where an admin needs to
 *  hand someone working credentials right now (e.g. in person, over the
 *  phone) instead of waiting on an invite/reset link.
 *
 *  Super Admin (system_admin) can set anyone's password, including other
 *  Super Admins. Admin (hr_admin) can set anyone's EXCEPT a Super
 *  Admin's -- mirrors the existing "only super admin can grant Admin or
 *  Super Admin" boundary already enforced for role changes on this page.
 *  Requires SUPABASE_SERVICE_ROLE_KEY to be configured. */
export async function POST(request: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile || profile.status !== "active" || !["hr_admin", "system_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403, headers: NO_STORE });
  }

  const body = await request.json().catch(() => null);
  const userId = String(body?.user_id || "").trim();
  const password = String(body?.password || "");

  if (!userId) {
    return NextResponse.json({ error: "Missing user." }, { status: 400, headers: NO_STORE });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400, headers: NO_STORE });
  }

  const supabase = await createClient();
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (targetError || !target) {
    return NextResponse.json({ error: "User not found." }, { status: 404, headers: NO_STORE });
  }

  if (profile.role === "hr_admin" && target.role === "system_admin") {
    return NextResponse.json(
      { error: "Only the Super Admin can set another Super Admin's password." },
      { status: 403, headers: NO_STORE }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Service role key isn't configured yet (SUPABASE_SERVICE_ROLE_KEY) — ask an admin to add it in Vercel." },
      { status: 501, headers: NO_STORE }
    );
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    return NextResponse.json({ error: error.message || "Could not set the password." }, { status: 400, headers: NO_STORE });
  }

  // Best-effort audit trail -- matches the existing admin_audit_log shape
  // used by role/status changes on this page. Not fatal if it fails (the
  // password change itself already succeeded above).
  await supabase.from("admin_audit_log").insert({
    actor_id: profile.id,
    action: "password_set",
    target_user_id: userId,
    details: { target_name: target.full_name },
  });

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
