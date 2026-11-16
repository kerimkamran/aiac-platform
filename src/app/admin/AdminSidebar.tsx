"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarLayout, type SidebarLink } from "@/components/SidebarLayout";

// Admin has four places (redesign plan B9/B11). Each one groups the pages that
// used to be eleven separate sections; the pages are unchanged and reachable
// from a small tab row above the content.
type Page = { label: string; href: string };
type Group = { id: string; label: string; icon: string; href: string; pages: Page[] };

const GROUPS: Group[] = [
  {
    id: "people",
    label: "People & roles",
    icon: "users",
    href: "/admin/users",
    pages: [
      { label: "Users", href: "/admin/users" },
      { label: "Roles & permissions", href: "/admin/roles" },
      { label: "Approvals", href: "/admin/approvals" },
    ],
  },
  {
    id: "organisation",
    label: "Organisation",
    icon: "building",
    href: "/admin/organizations",
    pages: [{ label: "Organisations", href: "/admin/organizations" }],
  },
  {
    id: "ai-data",
    label: "AI & data",
    icon: "brain",
    href: "/admin/ai-governance",
    pages: [
      { label: "AI settings", href: "/admin/ai-governance" },
      { label: "Data", href: "/admin/data-governance" },
      { label: "Security", href: "/admin/security" },
      { label: "API", href: "/admin/api-docs" },
    ],
  },
  {
    id: "activity",
    label: "Activity log",
    icon: "file",
    href: "/admin/audit",
    pages: [
      { label: "Activity log", href: "/admin/audit" },
      { label: "Notifications", href: "/admin/notifications" },
    ],
  },
];

const onPage = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

function activeGroup(pathname: string): Group {
  return GROUPS.find((g) => g.pages.some((p) => onPage(pathname, p.href))) ?? GROUPS[0];
}

export function AdminSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const group = activeGroup(pathname);
  // The overview page itself belongs to no group.
  const overview = pathname === "/admin";
  const sections: SidebarLink[] = GROUPS.map((g) => ({ id: g.id, label: g.label, icon: g.icon, href: g.href }));

  return (
    <>
      <div className="md:hidden overflow-x-auto no-print border-b border-line mb-2">
        <nav aria-label="Admin" className="flex gap-1 px-3 w-max min-w-full">
          {GROUPS.map((g) => (
            <Link
              key={g.id}
              href={g.href}
              aria-current={!overview && group.id === g.id ? "page" : undefined}
              className={`text-sm whitespace-nowrap px-3 py-3 border-b-2 transition-colors ${
                !overview && group.id === g.id ? "font-semibold text-foreground border-foreground" : "font-medium text-muted border-transparent"
              }`}
            >
              {g.label}
            </Link>
          ))}
        </nav>
      </div>
      <SidebarLayout title="Admin" sections={sections} activeId={overview ? "" : group.id}>
        {!overview && group.pages.length > 1 && (
          <nav aria-label={group.label} className="flex flex-wrap gap-1 px-6 lg:px-10 pt-6 lg:pt-8 no-print">
            {group.pages.map((p) => {
              const on = onPage(pathname, p.href);
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  aria-current={on ? "page" : undefined}
                  className={`min-h-11 inline-flex items-center rounded-md px-3 text-sm font-semibold ${
                    on ? "bg-brand text-on-primary" : "text-muted hover:text-foreground hover:bg-surface-sunken"
                  }`}
                >
                  {p.label}
                </Link>
              );
            })}
          </nav>
        )}
        {children}
      </SidebarLayout>
    </>
  );
}
