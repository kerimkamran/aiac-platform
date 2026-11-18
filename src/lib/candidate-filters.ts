import type { SupabaseClient } from "@supabase/supabase-js";

export type CandidateListFilters = {
  status?: string;
  q?: string;
  department?: string;
  vacancy?: string;
};

// PostgREST filter values are comma/paren/percent-sensitive; strip them so
// user input can't alter an .or() expression or escape an ilike pattern.
const STRIP = /[,%()]/g;

/**
 * Builds the filtered (not yet paginated) candidate_assessments query shared
 * by the Candidates list page and its Excel export (STF-B-16) -- the two
 * must filter identically, or "export all (filtered)" would silently not
 * match what the screen shows.
 *
 * `selectColumns` must contain the literal placeholders `__CANDIDATE_REL__`
 * and `__ASSESSMENT_REL__` wherever it embeds the candidate's profile and the
 * assessment, e.g.
 *   `id, status, candidate:__CANDIDATE_REL__(full_name, email, department), assessments:__ASSESSMENT_REL__(title, vacancy_title)`
 * so this function can switch those embeds to an inner join only when a
 * filter actually needs one -- PostgREST requires `!inner` to filter on an
 * embedded resource's columns, but forcing it unconditionally would hide any
 * row whose candidate or assessment relation is ever null.
 */
export function buildCandidateAssessmentQuery(
  supabase: SupabaseClient,
  selectColumns: string,
  filters: CandidateListFilters,
  opts: { count?: "exact" } = {}
) {
  const status = (filters.status || "").trim();
  const qSafe = (filters.q || "").trim().replace(STRIP, "");
  const deptSafe = (filters.department || "").trim().replace(STRIP, "");
  const vacancySafe = (filters.vacancy || "").trim().replace(STRIP, "");

  const needCandidateInner = !!(qSafe || deptSafe);
  const needAssessmentInner = !!vacancySafe;

  const candidateRel = needCandidateInner
    ? "profiles!candidate_assessments_candidate_id_fkey!inner"
    : "profiles!candidate_assessments_candidate_id_fkey";
  const assessmentRel = needAssessmentInner ? "assessments!inner" : "assessments";

  const select = selectColumns.replace("__CANDIDATE_REL__", candidateRel).replace("__ASSESSMENT_REL__", assessmentRel);

  let query = supabase.from("candidate_assessments").select(select, opts.count ? { count: opts.count } : undefined);

  if (status) query = query.eq("status", status);
  if (qSafe) query = query.or(`full_name.ilike.%${qSafe}%,email.ilike.%${qSafe}%`, { referencedTable: "candidate" });
  if (deptSafe) query = query.eq("candidate.department", deptSafe);
  if (vacancySafe) {
    // "Vacancy" in the UI is really coalesce(vacancy_title, title) -- match
    // whichever one the dropdown actually built its options from.
    query = query.or(`vacancy_title.eq.${vacancySafe},and(vacancy_title.is.null,title.eq.${vacancySafe})`, {
      referencedTable: "assessments",
    });
  }
  return query;
}

/** Pages through every row matching a query in chunks, instead of one
 * unbounded request that silently truncates at the API's row-limit cap. */
export async function fetchAllRows<T>(
  buildQuery: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> },
  chunkSize = 500
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + chunkSize - 1);
    if (error) break;
    const batch = data || [];
    all.push(...batch);
    if (batch.length < chunkSize) break;
    from += chunkSize;
  }
  return all;
}

/** Splits an array into chunks of at most `size` -- for .in() lookups
 * (scores, reviews) that would otherwise hit the same row/URL-length limits
 * when a filtered export spans hundreds or thousands of candidates. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
