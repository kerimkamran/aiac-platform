import { createClient } from "@/lib/supabase/server";
import { Avatar, Card, Icon, PageHeader } from "@/components/ui";
import Link from "next/link";

const PAGE_SIZE = 40;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; q?: string; from?: string; to?: string; page?: string }>;
}) {
  const { module = "", q = "", from = "", to = "", page = "1" } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const supabase = await createClient();

  let query = supabase
    .from("admin_audit_log")
    .select("id, module, action, target_type, target_id, ip, result, details, created_at, actor:profiles!admin_audit_log_actor_id_fkey(full_name, email)", { count: "exact" })
    .order("created_at", { ascending: false });
  if (module) query = query.eq("module", module);
  if (q) query = query.ilike("action", `%${q}%`);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to + "T23:59:59Z");

  const { data: events, count } = await query.range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const { data: modules } = await supabase.from("admin_audit_log").select("module").not("module", "is", null).limit(1000);
  const moduleOptions = [...new Set((modules || []).map((m) => m.module as string))].sort();

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader
        title="Audit logs"
        subtitle={`${count ?? 0} event(s). This log is append-only: UPDATE and DELETE are revoked at the database level.`}
      >
        <a
          href={`/admin/audit/export?${new URLSearchParams({ module, q, from, to }).toString()}`}
          className="inline-flex items-center gap-2 border border-line bg-surface text-foreground text-sm font-semibold px-4 py-2.5 rounded-xl hover:border-brand transition-colors"
        >
          <Icon name="download" className="w-4 h-4" />
          Export XLSX
        </a>
      </PageHeader>

      <form action="/admin/audit" className="flex flex-wrap items-center gap-2.5 mb-5">
        <select name="module" defaultValue={module} className="bg-surface border border-line rounded-xl px-3 py-2.5 text-sm" aria-label="Module">
          <option value="">All modules</option>
          {moduleOptions.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input name="q" defaultValue={q} placeholder="Action contains…" className="bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm w-44" aria-label="Action filter" />
        <label className="text-xs text-muted">From <input name="from" type="date" defaultValue={from} className="bg-surface border border-line rounded-xl px-3 py-2 text-sm ml-1" /></label>
        <label className="text-xs text-muted">To <input name="to" type="date" defaultValue={to} className="bg-surface border border-line rounded-xl px-3 py-2 text-sm ml-1" /></label>
        <button className="bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-light transition-colors">Filter</button>
      </form>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[780px]">
          <thead className="text-faint text-[11px] uppercase tracking-wider border-b border-line">
            <tr>
              <th className="text-left px-5 py-3.5 font-semibold">When</th>
              <th className="text-left px-5 py-3.5 font-semibold">Actor</th>
              <th className="text-left px-5 py-3.5 font-semibold">Module</th>
              <th className="text-left px-5 py-3.5 font-semibold">Action</th>
              <th className="text-left px-5 py-3.5 font-semibold">Target</th>
              <th className="text-left px-5 py-3.5 font-semibold">IP</th>
              <th className="text-left px-5 py-3.5 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(events || []).map((e) => {
              const actor = e.actor as unknown as { full_name: string; email: string } | null;
              return (
                <tr key={e.id} className="hover:bg-background/70">
                  <td className="px-5 py-3 text-muted whitespace-nowrap text-[12.5px]">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2">
                      <Avatar name={actor?.full_name || "?"} className="w-6 h-6 text-[9px]" />
                      <span className="font-medium text-foreground text-[13px]">{actor?.full_name || "System"}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted">{e.module || "—"}</td>
                  <td className="px-5 py-3 text-foreground font-medium">{e.action.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3 text-muted text-[12px]">{e.target_type ? `${e.target_type} ${String(e.target_id || "").slice(0, 8)}` : "—"}</td>
                  <td className="px-5 py-3 text-faint text-[12px]">{e.ip || "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[11px] font-bold ${e.result === "denied" ? "text-critical" : e.result === "error" ? "text-warning" : "text-good"}`}>
                      {e.result || "success"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {(!events || events.length === 0) && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-faint text-sm">No events match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between mt-5 text-sm">
        <p className="text-faint">Page {pageNum} of {totalPages}</p>
        <div className="flex gap-2">
          {pageNum > 1 && <Link href={`/admin/audit?${new URLSearchParams({ module, q, from, to, page: String(pageNum - 1) })}`} className="border border-line rounded-xl px-4 py-2 font-semibold hover:border-brand">Previous</Link>}
          {pageNum < totalPages && <Link href={`/admin/audit?${new URLSearchParams({ module, q, from, to, page: String(pageNum + 1) })}`} className="border border-line rounded-xl px-4 py-2 font-semibold hover:border-brand">Next</Link>}
        </div>
      </div>
    </div>
  );
}
