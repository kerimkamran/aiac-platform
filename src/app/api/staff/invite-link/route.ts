import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile, logAuditOrThrow } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { setPasswordLinkUrl } from "@/lib/site-url";

const NO_STORE = { "Cache-Control": "no-store" };

// Accounts only the Super Admin may create a link for. A "choose your
// password" link signs its holder in as that person, so a link for an admin
// account is the same as handing over that account.
const ADMIN_TIER = ["hr_admin", "org_admin", "system_admin"];

/** Generates a "choose your password" link directly via the Auth Admin API
 *  instead of sending an email -- lets an admin copy and share it by hand
 *  (Teams, a direct email) when Supabase's own mailer is rate-limited or a
 *  corporate mail filter is eating the message.
 *
 *  Who may call it mirrors /api/staff/set-password: HR Admin and Super Admin
 *  only, and only the Super Admin for admin-tier accounts. Every link is
 *  written to the audit log. Requires SUPABASE_SERVICE_ROLE_KEY. */
export async function POST(request: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile || profile.status !== "active" || !["hr_admin", "system_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403, headers: NO_STORE });
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400, headers: NO_STORE });
  }

  const supabase = await createClient();
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, full_name, role, status")
    .eq("email", email)
    .maybeSingle();

  if (targetError || !target) {
    return NextResponse.json({ error: "No account uses that email. Add the person first." }, { status: 404, headers: NO_STORE });
  }
  if (target.status !== "active") {
    return NextResponse.json({ error: "That account is not active. Reactivate it first." }, { status: 409, headers: NO_STORE });
  }
  if (ADMIN_TIER.includes(target.role) && profile.role !== "system_admin") {
    return NextResponse.json(
      { error: "Only the Super Admin can create a link for an admin account." },
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

  // The audit entry comes first: a link that signs someone in must never
  // exist without a record of who made it. No record, no link. Written
  // through the log_admin_event() RPC (security definer), like every other
  // admin action's audit entry -- not a direct table insert, which is
  // subject to RLS on this request's own session and was the reason this
  // route previously failed every time (pentest finding PT-02).
  try {
    await logAuditOrThrow({
      module: "users",
      action: "invite_link_generated",
      targetType: "user",
      targetId: target.id,
      targetUserId: target.id,
      details: { target_name: target.full_name, target_role: target.role },
    });
  } catch {
    return NextResponse.json({ error: "Couldn't record this in the activity log, so no link was made. Try again." }, { status: 500, headers: NO_STORE });
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    return NextResponse.json({ error: error?.message || "Could not generate a link." }, { status: 400, headers: NO_STORE });
  }

  // Not Supabase's own action_link: that one signs in through the address
  // bar, which this app's sign-in code does not accept. This link is verified
  // on the server at /auth/confirm, so it works on any device.
  return NextResponse.json({ link: setPasswordLinkUrl(tokenHash, "recovery") }, { headers: NO_STORE });
}
