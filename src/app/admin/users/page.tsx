import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Icon, PageHeader, StatusBadge } from "@/components/ui";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";
import { DataTable, DataTablePagination, type DataTableColumn } from "@/components/DataTable";

const TOASTS: ToastSpec[] = [
  { param: "ok", variant: "success" },
  { param: "error", variant: "error" },
];

const PAGE_SIZE = 25;
const ROLES = ["candidate", "recruiter", "assessor", "hiring_manager", "decision_maker", "client_user", "hr_admin", "org_admin", "system_admin"];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; type?: string; page?: string; sort?: string }>;
}) {
  const { q = "", role = "", status = "", type = "", page = "1", sort = "created_at" } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role, status, department, job_title, is_employee, last_login_at, created_at", { count: "exact" });

  // PostgREST filter values are comma/paren-sensitive; strip them (and %) so
  // user input can't alter the .or() expression.
  const qSafe = q.trim().replace(/[,%()]/g, "");
  if (qSafe) query = query.or(`full_name.ilike.%${qSafe}%,email.ilike.%${qSafe}%,department.ilike.%${qSafe}%`);
  if (role) query = query.eq("role", role);
  if (status) query = query.eq("status", status);
  if (type === "employee") query = query.eq("is_employee", true);
  if (type === "external") query = query.eq("is_employee", false);

  const sortCol = ["full_name", "email", "role", "last_login_at", "created_at"].includes(sort) ? sort : "created_at";
  const { data: users, count } = await query
    .order(sortCol, { ascending: sortCol === "full_name" || sortCol === "email" })
    .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ q, role, status, type, sort, ...overrides });
    for (const [k, v] of [...params.entries()]) if (!v) params.delete(k);
    return `/admin/users?${params.toString()}`;
  };

  type UserRow = NonNullable<typeof users>[number];
  // Matches the actual .order() direction below (full_name/email ascending,
  // everything else descending) so the header arrow never lies about which
  // way the column is currently sorted.
  const sortDir = (col: string) => (col === "full_name" || col === "email" ? "asc" : "desc");
  const columns: DataTableColumn<UserRow>[] = [
    {
      key: "user",
      label: "User",
      sortHref: qs({ sort: "full_name", page: "1" }),
      sortActive: sort === "full_name" ? sortDir("full_name") : undefined,
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.full_name || "?"} />
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate flex items-center gap-2">
              {u.full_name}
              {u.is_employee && (
                <span className="text-2xs font-bold uppercase tracking-wider text-accent-dark bg-brand-50 px-1.5 py-0.5 rounded">Employee</span>
              )}
            </p>
            <p className="text-xs text-muted truncate">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      sortHref: qs({ sort: "role", page: "1" }),
      sortActive: sort === "role" ? sortDir("role") : undefined,
      render: (u) => <span className="text-muted whitespace-nowrap">{u.role.replace(/_/g, " ")}</span>,
    },
    { key: "status", label: "Status", render: (u) => <StatusBadge status={u.status} /> },
    { key: "department", label: "Department", render: (u) => <span className="text-muted">{u.department || "—"}</span> },
    {
      key: "last_login_at",
      label: "Last login",
      sortHref: qs({ sort: "last_login_at", page: "1" }),
      sortActive: sort === "last_login_at" ? sortDir("last_login_at") : undefined,
      render: (u) => (
        <span className="text-muted whitespace-nowrap">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "never"}</span>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      sortHref: qs({ sort: "created_at", page: "1" }),
      sortActive: sort === "created_at" ? sortDir("created_at") : undefined,
      render: (u) => <span className="text-muted whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (u) => (
        <Link href={`/admin/users/${u.id}`} className="inline-flex items-center gap-1.5 text-accent-dark font-semibold hover:underline whitespace-nowrap">
          Manage
          <Icon name="arrowRight" className="w-3.5 h-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader title="Users" subtitle={`${total} account(s) — server-side pagination, filters, and sorting. Invitations and bulk import live in People.`}>
        <a
          href={`/admin/users/export?${new URLSearchParams({ q, role, status, type }).toString()}`}
          className="inline-flex items-center gap-2 border border-line bg-surface text-foreground text-sm font-semibold px-4 py-2.5 rounded-xl hover:border-brand transition-colors"
        >
          <Icon name="download" className="w-4 h-4" />
          Export XLSX
        </a>
        <Link
          href="/staff/people"
          className="inline-flex items-center gap-2 bg-brand-deep text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand transition-colors"
        >
          <Icon name="plus" className="w-4 h-4" />
          Invite / bulk import
        </Link>
      </PageHeader>

      <ToastFromParams specs={TOASTS} />

      {/* Filters */}
      <form action="/admin/users" className="flex flex-wrap items-center gap-2.5 mb-5">
        <div className="relative flex-1 min-w-56 max-w-sm">
          <Icon name="search" className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, department…"
            className="w-full bg-surface border border-line rounded-xl pl-10 pr-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <select name="role" defaultValue={role} className="bg-surface border border-line rounded-xl px-3 py-2.5 text-sm" aria-label="Filter by role">
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select name="status" defaultValue={status} className="bg-surface border border-line rounded-xl px-3 py-2.5 text-sm" aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
        </select>
        <select name="type" defaultValue={type} className="bg-surface border border-line rounded-xl px-3 py-2.5 text-sm" aria-label="Filter by audience">
          <option value="">Everyone</option>
          <option value="employee">Internal employees</option>
          <option value="external">External candidates</option>
        </select>
        <button className="bg-brand-deep text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand transition-colors">Filter</button>
      </form>

      <DataTable
        columns={columns}
        rows={users || []}
        getRowKey={(u) => u.id}
        caption="Users"
        minWidthClassName="min-w-[760px]"
        emptyMessage="No users match these filters."
      />

      <DataTablePagination pageNum={pageNum} totalPages={totalPages} total={total} makeHref={(p) => qs({ page: String(p) })} />
    </div>
  );
}
