"use server";

// Scout is the app-wide navigation/help guide, available to every role
// including anonymous visitors -- unlike the report-chat feature, it has no
// access to any user's private data, so it's deliberately NOT gated behind
// requireStaff()/is_staff(). It only needs the Kimi API key (for open-ended
// fallback questions) and static app-structure knowledge.
//
// get_engine_api_key() is gated behind is_staff() in Postgres (correctly --
// that RPC is meant for staff-only features like report-chat and case
// generation), so it can't be reused here for anonymous/candidate callers.
// get_engine_api_key_for_scout() (0011_scout_engine_key_rpc migration) is a
// narrow twin with no role gate, but is revoked from anon/authenticated at
// the Postgres grant level -- only code calling through the service_role
// client (this file) can invoke it, so the boundary is "server code only,"
// not "any logged-in user." Degrades gracefully if the service role key
// isn't configured in this environment.

import { createAdminClient } from "@/lib/supabase/admin";
import { runScoutChat, type ScoutChatMessage } from "@/lib/scout-chat";
import type { ScoutRole } from "@/lib/scout-intents";

export async function sendScoutMessage(role: ScoutRole, history: ScoutChatMessage[]): Promise<string> {
  // Basic abuse/cost guard -- this endpoint is reachable by anonymous
  // visitors (no auth gate, by design), so cap conversation length and a
  // single message's size rather than trust the client entirely.
  if (history.length > 12) {
    throw new Error("This conversation has gotten long -- try opening a fresh question.");
  }
  for (const m of history) {
    if (m.content.length > 2000) {
      throw new Error("That message is too long -- try asking something shorter.");
    }
  }

  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Scout's AI fallback isn't configured in this environment yet -- ask an admin to set SUPABASE_SERVICE_ROLE_KEY.");
  }

  const { data: apiKey, error } = await admin.rpc("get_engine_api_key_for_scout", { p_engine_key: "kimi" });
  if (error || !apiKey) {
    throw new Error("Scout's AI engine isn't configured yet -- ask an admin to add a Kimi API key in Settings.");
  }

  return runScoutChat(apiKey, role, history);
}
