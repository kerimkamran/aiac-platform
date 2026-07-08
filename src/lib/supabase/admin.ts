import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for privileged Auth Admin operations (e.g. generating
 * invite/recovery links directly instead of relying on Supabase's mailer).
 * Server-only -- never import this from a Client Component. Returns null if
 * SUPABASE_SERVICE_ROLE_KEY isn't configured, so callers must degrade
 * gracefully rather than assume it's always available.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
