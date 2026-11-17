import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { getSessionProfile } from "@/lib/authz";
import { LEVELS, isLevelKey } from "@/lib/levels";
import { InviteWizard, type InviteTest } from "./InviteWizard";

// Every active staff member (recruiters and hiring managers included) can
// invite candidates here. It only ever creates candidate accounts.
export default async function InviteCandidatesPage({ searchParams }: { searchParams: Promise<{ test?: string }> }) {
  const { test } = await searchParams;
  const supabase = await createClient();
  const me = await getSessionProfile();
  const { data } = await supabase
    .from("assessments")
    .select("id, title, time_limit_minutes, target_level, content_language")
    .eq("status", "published")
    .order("title");

  const tests: InviteTest[] = (data || []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    minutes: (t.time_limit_minutes as number) ?? 0,
    level: isLevelKey(t.target_level) ? LEVELS[t.target_level].label : null,
    language: (t.content_language as string | null) ?? null,
  }));
  // Opened from a test ("Invite candidates to this test"): preselect it, but only
  // when it really is one of the published tests.
  const preselected = tests.some((t) => t.id === test) ? (test as string) : "";

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <PageHeader title="Invite candidates" subtitle="Three short steps. Everyone gets an email with a link to choose a password and start." />
      <InviteWizard tests={tests} preselected={preselected} canCopyLink={me?.role === "hr_admin" || me?.role === "system_admin"} />
    </div>
  );
}
