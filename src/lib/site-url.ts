/**
 * The public origin used to build invite / password-reset redirect links.
 *
 * Order: NEXT_PUBLIC_SITE_URL (explicit, canonical) → the project's production
 * domain (Vercel sets VERCEL_PROJECT_PRODUCTION_URL) → this deployment's URL
 * (VERCEL_URL) → localhost for local development.
 *
 * Server-only. The invite links must point at a host that is listed in
 * Supabase Auth → URL Configuration → Redirect URLs, or Supabase silently
 * falls back to the Site URL and the invitee never reaches the set-password
 * page.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) return `https://${deployment.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

export function inviteRedirectUrl(): string {
  return `${siteUrl()}/invite/callback`;
}
