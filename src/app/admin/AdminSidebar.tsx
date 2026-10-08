"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarLayout, type SidebarLink } from "@/components/NavShell";

// Design-execution-plan Phase 5 / T5.4: these eleven destinations used to all
// live as a single crowded row of links in the admin area's own top bar
// (NavShell's `links` prop, previously admin/layout.tsx's full list) --
// exactly the kind of "deep page with its own sub-sections" NavShell.tsx's
// SidebarLayout was already built for, but nothing had wired it up yet. The
// admin layout's top bar now carries only the true top-level entries
// (Overview, Back to Workspace); this component is what actually lists the
// sub-pages, as a persistent rail on wider screens and a horizontal scrollable
// strip on narrow ones (SidebarLayout's own rail is desktop-only by design,
// matching the pattern already used for the Builder and candidate-detail
// sidebars) so nothing that was reachable from a phone before becomes
// unreachable now.
const SECTIONS: SidebarLink[] = [
  { id: "overview", label: "Overview", icon: "shield", href: "/admin" },
  { id: "users", label: "Users", icon: "users", href: "/admin/users" },
  { id: "roles", label: "Roles & Permissions", icon: "check", href: "/admin/roles" },
  { id: "organizations", label: "Organizations", icon: "building", href: "/admin/organizations" },
  { id: "approvals", label: "Approvals", icon: "checkCircle", href: "/admin/approvals" },
  { id: "audit", label: "Audit Logs", icon: "file", href: "/admin/audit" },
  { id: "notifications", label: "Notifications", icon: "mail", href: "/admin/notifications" },
  { id: "security", label: "Security", icon: "ban", href: "/admin/security" },
  { id: "ai-governance", label: "AI Governance", icon: "brain", href: "/admin/ai-governance" },
  { id: "data-governance", label: "Data Governance", icon: "layers", href: "/admin/data-governance" },
  { id: "api-docs", label: "API", icon: "command", href: "/admin/api-docs" },
];

function activeSectionId(pathname: string): string {
  const match = SECTIONS.find((s) =>
    s.href === "/admin" ? pathname === "/admin" : pathname === s.href || pathname.startsWith(s.href + "/")
  );
  return match?.id ?? "overview";
}

export function AdminSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = activeSectionId(pathname);

  return (
    <>
      <div className="md:hidden overflow-x-auto no-print border-b border-line mb-2">
        <nav className="flex gap-1 px-3 w-max min-w-full">
          {SECTIONS.map((s) => (
            <Link
              key={s.id}
              href={s.href!}
              className={`text-xs whitespace-nowrap px-3 py-2.5 border-b-2 transition-colors ${
                active === s.id ? "font-semibold text-foreground border-foreground" : "font-medium text-muted border-transparent"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>
      <SidebarLayout title="Admin" sections={SECTIONS} activeId={active}>
        {children}
      </SidebarLayout>
    </>
  );
}
