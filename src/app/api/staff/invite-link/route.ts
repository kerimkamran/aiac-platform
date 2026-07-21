import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

const NO_STORE = { "Cache-Control": "no-store" };

/** Generates a "set your password" link directly via the Auth Admin API
 *  instead of sending an email -- lets staff copy/share it manually
 *  (Slack, Teams, a direct email) when Supabase's own mailer is
 *  rate-limited or a corporate mail filter is eating the message.
 *  Staff-only; requires SUPABASE_SERVICE_ROLE_KEY to be configured. */
export async function POST(request: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile || profile.status !== "active" || ["candidate", "decision_maker"].includes(profile.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403, headers: NO_STORE });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Service role key isn't configured yet (SUPABASE_SERVICE_ROLE_KEY) — ask an admin to add it in Vercel." },
      { status: 501, headers: NO_STORE }
    );
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400, headers: NO_STORE });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://vantage-ag.vercel.app");

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${site}/invite/callback` },
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.json({ error: error?.message || "Could not generate a link." }, { status: 400, headers: NO_STORE });
  }

  return NextResponse.json({ link: data.properties.action_link }, { headers: NO_STORE });
}
