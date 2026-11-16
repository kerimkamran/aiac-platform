// Email links that let a person choose a password (invitations, "Copy invite
// link" and password resets). Pure helpers, shared by the server and the
// browser and covered by tests.
//
// Three link shapes can reach the app:
//   1. /auth/confirm?token_hash=...&type=recovery   the email templates in
//      supabase/email-templates and "Copy invite link". Verified on the server,
//      so it works on any device.
//   2. /invite/callback#access_token=...&refresh_token=...   what Supabase's
//      default template produces. The tokens are handed to the server.
//   3. /invite/callback?code=...   a PKCE link from an email sent before this
//      flow existed. It only works in the browser that asked for it.

// Link types the app accepts from an email. "email_change" is deliberately
// absent: nothing in Vantage sends it.
export const LINK_TYPES = ["recovery", "invite", "magiclink", "email", "signup"] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export function parseLinkType(raw: string | null | undefined): LinkType | null {
  return (LINK_TYPES as readonly string[]).includes(raw ?? "") ? (raw as LinkType) : null;
}

// A token hash is a short URL-safe string (hex, optionally prefixed "pkce_").
// Anything else is not worth sending to the auth server.
export function isTokenHash(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{16,256}$/.test(raw);
}

export function confirmPath(tokenHash: string, type: LinkType): string {
  return `/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`;
}

export type IncomingLink =
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "code"; code: string }
  | { kind: "error" }
  | { kind: "none" };

// Reads what an email link left in the address bar of /invite/callback.
// `hash` and `search` are window.location.hash and window.location.search.
export function readIncomingLink(hash: string, search: string): IncomingLink {
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const query = new URLSearchParams(search.replace(/^\?/, ""));

  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (accessToken && refreshToken) return { kind: "tokens", accessToken, refreshToken };

  // Supabase reports a used or expired link as error parameters, in the
  // fragment, the query, or both.
  for (const params of [fragment, query]) {
    if (params.get("error") || params.get("error_code") || params.get("error_description")) return { kind: "error" };
  }

  const code = query.get("code");
  if (code) return { kind: "code", code };

  return { kind: "none" };
}

// Reads the claims of an access token without checking its signature. Only
// used to decide what to show or whether to hand the token to the auth
// server, which does the real check.
export type TokenClaims = { sub: string | null; email: string | null; amr: { method: string; timestamp: number | null }[] };

export function readTokenClaims(accessToken: string): TokenClaims | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const text = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    const json = JSON.parse(text) as {
      sub?: unknown;
      email?: unknown;
      amr?: unknown;
    };
    const amr = Array.isArray(json.amr)
      ? json.amr.map((entry) =>
          typeof entry === "string"
            ? { method: entry, timestamp: null }
            : {
                method: String((entry as { method?: unknown } | null)?.method ?? ""),
                timestamp: typeof (entry as { timestamp?: unknown } | null)?.timestamp === "number" ? ((entry as { timestamp: number }).timestamp) : null,
              }
        )
      : [];
    return {
      sub: typeof json.sub === "string" ? json.sub : null,
      email: typeof json.email === "string" ? json.email : null,
      amr,
    };
  } catch {
    return null;
  }
}

// How a session was started when it came from an email link, as Supabase
// records it in the token's "amr" claim.
const EMAIL_LINK_METHODS = ["otp", "recovery", "invite", "magiclink", "email/signup"];
// An email link is used within a day of being sent; tokens older than that
// did not come from a link someone has just opened.
export const EMAIL_LINK_MAX_AGE_SECONDS = 24 * 60 * 60;

// True only for a session that was started from an email link in the last
// day. Anything else (a password sign-in, an old session, a token with no
// "amr" claim) is not accepted from the address bar.
export function isEmailLinkSession(accessToken: string, nowSeconds: number): boolean {
  const claims = readTokenClaims(accessToken);
  if (!claims) return false;
  return claims.amr.some(
    (entry) =>
      EMAIL_LINK_METHODS.includes(entry.method) &&
      entry.timestamp !== null &&
      entry.timestamp <= nowSeconds + 60 &&
      nowSeconds - entry.timestamp <= EMAIL_LINK_MAX_AGE_SECONDS
  );
}
