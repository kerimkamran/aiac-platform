import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Callout } from "@/components/ui/Callout";
import { ListRow } from "@/components/ui/Surfaces";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui";
import { nowMs } from "@/lib/time";

export const metadata = { title: "System" };

// System horizon (Clear Horizon plan, section 10): exceptions only. When
// nothing needs attention the page says so and stays quiet; otherwise each
// exception is one line with a way to act. All counts are head-only queries.
const INDEX = [
  { href: "/admin/users", label: "Users", note: "Accounts, roles and status" },
  { href: "/admin/roles", label: "Roles & permissions", note: "What each role can do" },
  { href: "/admin/organizations", label: "Organizations", note: "Companies and teams" },
  { href: "/admin/approvals", label: "Approvals", note: "Requests that need a second person" },
  { href: "/admin/audit", label: "Audit log", note: "Every admin action, append-only" },
  { href: "/admin/security", label: "Security", note: "Sign-in and session rules" },
  { href: "/admin/ai-governance", label: "AI governance", note: "Scoring engines and keys" },
  { href: "/admin/data-governance", label: "Data governance", note: "Retention and exports" },
  { href: "/admin/notifications", label: "Notifications", note: "What people are told, and when" },
  { href: "/admin/api-docs", label: "API", note: "Endpoints and reference" },
];

export default async function SystemHorizon() {
  const supabase = await createClient();
  const weekAgo = new Date(nowMs() - 7 * 86_400_000).toISOString();

  const [{ count: pending }, { count: denied }, { count: inactive }, { data: recent }] = await Promise.all([
    supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("admin_audit_log").select("id", { count: "exact", head: true }).eq("result", "denied").gte("created_at", weekAgo),
    supabase.from("profiles").select("id", { count: "exact", head: true }).neq("status", "active"),
    supabase
      .from("admin_audit_log")
      .select("id, module, action, result, created_at, actor:profiles!admin_audit_log_actor_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const exceptions: { key: string; tone: "warning" | "info"; text: string; href: string; cta: string }[] = [];
  if ((pending ?? 0) > 0)
    exceptions.push({
      key: "approvals",
      tone: "warning",
      text: pending === 1 ? "1 approval is waiting for a decision." : `${pending} approvals are waiting for a decision.`,
      href: "/admin/approvals",
      cta: "Review approvals",
    });
  if ((denied ?? 0) > 0)
    exceptions.push({
      key: "denied",
      tone: "warning",
      text: denied === 1 ? "1 action was denied in the last 7 days." : `${denied} actions were denied in the last 7 days.`,
      href: "/admin/audit",
      cta: "Open the audit log",
    });

  return (
    <div className="px-1 py-2">
      <h1 className="text-display text-foreground measure">{exceptions.length === 0 ? "Nothing needs attention." : "A few things need attention."}</h1>
      <p className="mt-2 text-body-large text-muted measure">
        {exceptions.length === 0 ? "No pending approvals and no denied actions this week." : "Everything else is running as expected."}
      </p>

      {exceptions.length > 0 && (
        <div className="mt-6 space-y-3">
          {exceptions.map((e) => (
            <Callout key={e.key} tone={e.tone}>
              <span className="flex flex-wrap items-center justify-between gap-3">
                <span>{e.text}</span>
                <Link href={e.href} className="font-semibold underline underline-offset-4">
                  {e.cta}
                </Link>
              </span>
            </Callout>
          ))}
        </div>
      )}

      <p className="mt-6 text-sm text-muted">
        {(inactive ?? 0) === 0 ? "All accounts are active." : `${inactive} ${inactive === 1 ? "account is" : "accounts are"} suspended or deactivated.`}{" "}
        <Link href="/admin/users" className="font-semibold text-accent hover:underline">
          Manage users
        </Link>
      </p>

      <section aria-labelledby="idx-h" className="mt-12">
        <h2 id="idx-h" className="text-title-large text-foreground">
          Everything in Admin
        </h2>
        <div className="mt-3 border-t border-line">
          {INDEX.map((s) => (
            <ListRow key={s.href} href={s.href}>
              <p className="text-base font-semibold text-foreground">{s.label}</p>
              <p className="text-sm text-muted">{s.note}</p>
            </ListRow>
          ))}
        </div>
      </section>

      <section aria-labelledby="act-h" className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 id="act-h" className="text-title-large text-foreground">
            Latest activity
          </h2>
          <Link href="/admin/audit" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
            Full audit log
          </Link>
        </div>
        <ul className="mt-3 border-t border-line">
          {(recent || []).map((e) => {
            const actor = e.actor as unknown as { full_name: string } | null;
            return (
              <li key={e.id} className="flex items-center gap-3 border-b border-line-soft py-3 text-sm">
                <Avatar name={actor?.full_name || "?"} className="w-8 h-8 text-xs" />
                <span className="truncate font-semibold text-foreground">{actor?.full_name || "System"}</span>
                <span className="truncate text-muted">
                  {e.module ? `${e.module} · ` : ""}
                  {e.action.replace(/_/g, " ")}
                </span>
                {e.result === "denied" && <span className="inline-flex items-center gap-1 font-semibold text-critical"><Icon name="ban" className="w-3.5 h-3.5" />Denied</span>}
                <span className="ml-auto whitespace-nowrap text-muted">{new Date(e.created_at).toLocaleDateString()}</span>
              </li>
            );
          })}
          {(!recent || recent.length === 0) && <li className="py-6 text-base text-muted">No activity recorded yet.</li>}
        </ul>
      </section>
    </div>
  );
}
