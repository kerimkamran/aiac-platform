import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/authz";

export type SearchResult = {
  type: "candidate" | "assessment";
  label: string;
  sublabel: string;
  href: string;
  icon: string;
};

const NO_STORE = { "Cache-Control": "no-store" };

/** Internal endpoint powering the ⌘K palette's entity search. Staff-only;
 *  intentionally outside the versioned /api/v1 REST surface. */
export async function GET(request: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ results: [] }, { status: 401, headers: NO_STORE });
  }
  if (profile.status !== "active" || ["candidate", "decision_maker"].includes(profile.role)) {
    return NextResponse.json({ results: [] }, { status: 403, headers: NO_STORE });
  }

  // PostgREST filter values are comma/paren-sensitive; strip them (and %) so
  // user input can't alter the .or() expression.
  const q = (request.nextUrl.searchParams.get("q") || "").trim().replace(/[,%()]/g, "");
  if (q.length < 2) {
    return NextResponse.json({ results: [] }, { headers: NO_STORE });
  }

  try {
    const supabase = await createClient();
    const [{ data: cands }, { data: assessments }] = await Promise.all([
      supabase
        .from("candidate_assessments")
        .select("id, candidate:profiles!candidate_assessments_candidate_id_fkey!inner(full_name, email), assessments(title)")
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`, { referencedTable: "candidate" })
        .order("invited_at", { ascending: false })
        .limit(6),
      supabase.from("assessments").select("id, title").ilike("title", `%${q}%`).limit(4),
    ]);

    const results: SearchResult[] = [];
    for (const row of (cands || []) as unknown as {
      id: string;
      candidate: { full_name: string; email: string } | null;
      assessments: { title: string } | null;
    }[]) {
      results.push({
        type: "candidate",
        label: row.candidate?.full_name || "Unknown",
        sublabel: [row.candidate?.email, row.assessments?.title].filter(Boolean).join(" · "),
        href: `/staff/reports/candidates/${row.id}`,
        icon: "users",
      });
    }
    for (const a of (assessments || []) as { id: string; title: string }[]) {
      results.push({ type: "assessment", label: a.title, sublabel: "Assessment", href: `/staff/builder/${a.id}`, icon: "layers" });
    }

    return NextResponse.json({ results: results.slice(0, 8) }, { headers: NO_STORE });
  } catch {
    // Palette degrades silently — an empty result set, not an error surface.
    return NextResponse.json({ results: [] }, { headers: NO_STORE });
  }
}
