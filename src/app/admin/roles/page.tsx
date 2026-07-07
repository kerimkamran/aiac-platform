import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";
import { saveRoleMatrix } from "../actions";

const TOASTS: ToastSpec[] = [
  { param: "ok", variant: "success" },
  { param: "error", variant: "error" },
];

const ROLE_ORDER = ["system_admin", "org_admin", "hr_admin", "recruiter", "assessor", "hiring_manager", "decision_maker", "client_user", "candidate"];

export default async function AdminRolesPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role = "recruiter" } = await searchParams;
  const supabase = await createClient();

  const [{ data: perms }, { data: grants }] = await Promise.all([
    supabase.from("permissions").select("id, module, action").order("module").order("action"),
    supabase.from("role_permissions").select("permission_id").eq("role", role),
  ]);

  const grantedIds = new Set((grants || []).map((g) => g.permission_id));
  const modules = [...new Set((perms || []).map((p) => p.module))];
  const actions = [...new Set((perms || []).map((p) => p.action))];
  const byKey = new Map((perms || []).map((p) => [`${p.module}.${p.action}`, p.id]));

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Module × action matrix per role. system_admin implicitly retains full access; per-user temporary overrides live on each user's page."
      />
      <ToastFromParams specs={TOASTS} />

      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Roles">
        {ROLE_ORDER.map((r) => (
          <a
            key={r}
            role="tab"
            aria-selected={role === r}
            href={`/admin/roles?role=${r}`}
            className={`px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
              role === r ? "bg-brand text-white" : "bg-surface border border-line text-muted hover:text-foreground"
            }`}
          >
            {r.replace(/_/g, " ")}
          </a>
        ))}
      </div>

      <Card className="p-6 overflow-x-auto">
        <form action={saveRoleMatrix}>
          <input type="hidden" name="role" value={role} />
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr className="text-faint text-[11px] uppercase tracking-wider border-b border-line">
                <th className="text-left px-3 py-3 font-semibold">Module</th>
                {actions.map((a) => (
                  <th key={a} className="px-3 py-3 font-semibold text-center">{a}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {modules.map((m) => (
                <tr key={m}>
                  <td className="px-3 py-3 font-semibold text-foreground">{m}</td>
                  {actions.map((a) => {
                    const pid = byKey.get(`${m}.${a}`);
                    if (!pid) return <td key={a} />;
                    return (
                      <td key={a} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          name="perm"
                          value={pid}
                          defaultChecked={grantedIds.has(pid)}
                          aria-label={`${role}: ${m} ${a}`}
                          className="w-4 h-4 accent-[color:var(--brand)]"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-faint max-w-md">
              Changes apply immediately to every user with the <span className="font-semibold">{role.replace(/_/g, " ")}</span> role and are audited.
            </p>
            <button className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-light transition-colors">
              Save matrix
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
