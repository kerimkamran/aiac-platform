// Where each role lands (Clear Horizon plan, section 9): candidate to their
// path, decision maker to the decision deck, system admin to the system
// horizon, and every other staff role to the staff home. Pure, so the
// middleware, server components and tests can all use it.
export function homeFor(role: string | null | undefined): string {
  switch (role) {
    case "candidate":
      return "/candidate";
    case "decision_maker":
      return "/decision";
    case "system_admin":
      return "/admin";
    case "recruiter":
    case "hiring_manager":
    case "hr_admin":
    case "org_admin":
      return "/staff";
    default:
      return "/login";
  }
}

// Validates a "return to" path from a query string so a sign-in link can never
// redirect to another site. Only same-origin absolute paths are accepted: they
// must start with a single "/", contain no backslash or control characters, and
// not point back at the sign-in pages.
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  if (raw.length > 512) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return null;
  const path = raw.split(/[?#]/)[0];
  if (/^\/(login|signup|forgot-password|invite|logout)(\/|$)/.test(path)) return null;
  return raw;
}
