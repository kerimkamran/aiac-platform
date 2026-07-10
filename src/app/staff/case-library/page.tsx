import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, Icon, PageHeader, categoryStyle } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { generateCasesForCompetency, generateCasesForAllCompetencies, deleteCase, uploadCasesFromFile } from "./actions";
import { ToastFromParams, type ToastSpec } from "@/components/Toaster";

const TOAST_SPECS: ToastSpec[] = [
  { param: "error", variant: "error" },
  { param: "upload_error", variant: "error" },
  {
    param: "uploaded",
    variant: "success",
    clearParams: ["uploaded", "upload_ai", "upload_errors", "upload_error_sample"],
    kind: "case-library-upload",
  },
];

// A single bulk "generate for all 37 competencies" run makes many sequential
// LLM calls in batches — comfortably longer than a single-assessment
// generation, so this route gets a wider ceiling than the default.
export const maxDuration = 280;

const ENGINE_LABEL: Record<string, string> = { claude: "Claude", fugu: "Sakana Fugu", kimi: "Kimi" };

export default async function CaseLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    competency?: string;
    tag?: string;
    uploaded?: string;
    upload_errors?: string;
    upload_error_sample?: string;
    upload_error?: string;
    upload_ai?: string;
  }>;
}) {
  const { competency: competencyFilter, tag: tagFilter } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile || profile.role !== "system_admin") {
    redirect("/staff?error=" + encodeURIComponent("The case library is restricted to the super admin."));
  }

  const [{ data: competencies }, { data: engines }, { data: cases }] = await Promise.all([
    supabase.from("competencies").select("id, code, name, category").order("category").order("name"),
    supabase.from("generation_engines").select("key, display_name, enabled, api_key_secret_id"),
    supabase
      .from("case_library")
      .select("id, title, scenario_text, question_stem, question_type, options, difficulty, methodology_tag, methodology_notes, engine, generated_at, competency_id, competencies(name, category, code)")
      .order("generated_at", { ascending: false }),
  ]);

  const availableEngines = (engines || []).filter((e) => e.enabled && e.api_key_secret_id);
  const compList = competencies || [];

  type CaseRow = {
    id: string;
    title: string;
    scenario_text: string;
    question_stem: string;
    question_type: string;
    options: { key: string; text: string; correct?: boolean }[] | null;
    difficulty: string;
    methodology_tag: string;
    methodology_notes: string | null;
    engine: string | null;
    generated_at: string;
    competency_id: string;
    competencies: { name: string; category: string; code: string } | null;
  };

  let list = (cases || []) as unknown as CaseRow[];
  if (competencyFilter) list = list.filter((c) => c.competency_id === competencyFilter);
  if (tagFilter) list = list.filter((c) => c.methodology_tag === tagFilter);

  const methodologyTags = Array.from(new Set((cases || []).map((c) => c.methodology_tag))).sort();
  const countByCompetency = new Map<string, number>();
  for (const c of (cases || []) as unknown as CaseRow[]) {
    countByCompetency.set(c.competency_id, (countByCompetency.get(c.competency_id) || 0) + 1);
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <PageHeader
        title="Case Library"
        subtitle="A large, original bank of situational judgment cases, grounded in research on Hogan Assessments, Mercer | Mettl, WTW/Saville, Korn Ferry, and McLean & Company's publicly documented methodology. Visible only to the super admin."
      />

      <ToastFromParams specs={TOAST_SPECS} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted">{list.length} case{list.length === 1 ? "" : "s"}</span>
            {(competencyFilter || tagFilter) && (
              <Link href="/staff/case-library" className="text-xs font-semibold text-accent-dark underline">
                Clear filters
              </Link>
            )}
          </div>

          {list.length === 0 && (
            <Card className="p-8 text-center">
              <p className="font-semibold text-foreground">No cases yet</p>
              <p className="text-sm text-muted mt-1">Generate the library from the panel on the right.</p>
            </Card>
          )}

          {list.map((c) => {
            const style = categoryStyle(c.competencies?.category || "Core");
            return (
              <Card key={c.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground">{c.title}</p>
                    <p className="flex items-center gap-2 text-[11px] text-muted mt-1">
                      <span className={`inline-flex items-center gap-1.5 font-semibold ${style.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {c.competencies?.name}
                      </span>
                      <span className="text-faint">·</span>
                      <span className="font-semibold text-accent-dark bg-accent-soft px-2 py-0.5 rounded-full">{c.methodology_tag}</span>
                      <span className="text-faint">·</span>
                      <span className="uppercase font-semibold text-faint">{c.difficulty}</span>
                    </p>
                  </div>
                  <form action={deleteCase.bind(null, c.id)}>
                    <ConfirmSubmitButton
                      confirmMessage="Delete this case from the library?"
                      icon="trash"
                      className="p-1.5 rounded-lg text-faint hover:text-critical hover:bg-red-50 transition-colors"
                      compact
                    />
                  </form>
                </div>
                <p className="text-[13px] text-foreground leading-relaxed mb-2">{c.scenario_text}</p>
                <p className="text-[13px] font-semibold text-foreground mb-2">{c.question_stem}</p>
                {c.question_type === "mcq" && c.options && (
                  <ul className="text-xs text-muted grid sm:grid-cols-2 gap-1 mb-2">
                    {c.options.map((o, i) => (
                      <li key={i} className={o.correct ? "text-emerald-700 font-medium" : ""}>
                        {String.fromCharCode(65 + i)}. {o.text} {o.correct ? "✓" : ""}
                      </li>
                    ))}
                  </ul>
                )}
                {c.methodology_notes && <p className="text-[11px] text-faint italic">{c.methodology_notes}</p>}
                <p className="text-[10.5px] text-faint mt-2">
                  via {ENGINE_LABEL[c.engine || ""] || c.engine || "—"} · {new Date(c.generated_at).toLocaleDateString()}
                </p>
              </Card>
            );
          })}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="font-bold text-foreground text-sm flex items-center gap-2 mb-1">
              <Icon name="brain" className="w-4 h-4 text-accent-dark" />
              Generate library
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-accent-dark bg-accent-soft px-2 py-0.5 rounded-full ml-auto">
                Superadmin
              </span>
            </p>
            <p className="text-xs text-muted mb-4">
              Cases are grounded in a research playbook synthesizing publicly documented methodology from Hogan
              Assessments, Mercer | Mettl, WTW/Saville, Korn Ferry, and McLean &amp; Company — no proprietary vendor
              content is reproduced.
            </p>

            {availableEngines.length === 0 ? (
              <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                No generation engine configured yet — add a Claude, Sakana Fugu, or Kimi API key in{" "}
                <Link href="/staff/settings" className="underline font-semibold">
                  Settings
                </Link>{" "}
                first.
              </p>
            ) : (
              <>
                <form action={generateCasesForAllCompetencies} className="space-y-3 mb-5 pb-5 border-b border-line">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">All 37 competencies</p>
                  <select name="engine" required className="w-full bg-background border border-line rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                    {availableEngines.map((e) => (
                      <option key={e.key} value={e.key}>
                        {e.display_name}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    Cases per competency
                    <input name="count" type="number" min={2} max={20} defaultValue={6} className="w-16 bg-background border border-line rounded-lg px-2 py-1.5" />
                  </label>
                  <button className="w-full bg-accent text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-accent-dark transition-colors">
                    Generate for every competency
                  </button>
                  <p className="text-[10.5px] text-faint">
                    Runs in batches across all competencies — a full pass can take a few minutes.
                  </p>
                </form>

                <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint mb-2">One competency</p>
                <div className="max-h-64 overflow-y-auto border border-line rounded-xl p-3 space-y-1 mb-3">
                  {compList.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 text-[12.5px] py-1">
                      <span className="min-w-0 truncate">{c.name}</span>
                      <span className="text-[10.5px] text-faint shrink-0">{countByCompetency.get(c.id) || 0} cases</span>
                    </div>
                  ))}
                </div>
                <form action={async (formData: FormData) => {
                  "use server";
                  const competencyId = String(formData.get("competency_id") || "");
                  await generateCasesForCompetency(competencyId, formData);
                }} className="space-y-2">
                  <select name="competency_id" required className="w-full bg-background border border-line rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                    <option value="">Choose a competency…</option>
                    {compList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.category})
                      </option>
                    ))}
                  </select>
                  <select name="engine" required className="w-full bg-background border border-line rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                    {availableEngines.map((e) => (
                      <option key={e.key} value={e.key}>
                        {e.display_name}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    Cases
                    <input name="count" type="number" min={2} max={20} defaultValue={8} className="w-16 bg-background border border-line rounded-lg px-2 py-1.5" />
                  </label>
                  <button className="w-full border border-line rounded-xl py-2.5 text-sm font-semibold text-foreground hover:border-brand transition-colors">
                    Generate for this competency
                  </button>
                </form>
              </>
            )}
          </Card>

          <Card className="p-6">
            <p className="font-bold text-foreground text-sm flex items-center gap-2 mb-1">
              <Icon name="download" className="w-4 h-4 text-accent-dark" />
              Upload cases
            </p>
            <p className="text-xs text-muted mb-4">
              Add cases from an existing file instead of (or alongside) AI generation. Accepts Excel (.xlsx), Word
              (.docx), plain text (.txt), or Markdown (.md).
            </p>
            <details className="mb-4 text-xs text-muted">
              <summary className="cursor-pointer font-semibold text-accent-dark">Expected format</summary>
              <p className="mt-2">
                <span className="font-semibold text-foreground">Excel:</span> one row per case with headers like
                Competency, Title, Scenario, Question, Type, Option A–D, Difficulty, Methodology.
              </p>
              <p className="mt-2">
                <span className="font-semibold text-foreground">Word / text / Markdown:</span> labeled fields per
                case, separated by a line of <code>---</code>. Plain or <code>**bold**</code> labels both work, and a
                heading can stand in for <code>Title:</code>:
              </p>
              <pre className="mt-1.5 bg-background border border-line rounded-lg p-2.5 text-[10.5px] whitespace-pre-wrap">
{`## Handling a missed deadline
**Competency:** CF-F09
**Difficulty:** mid
**Methodology:** Mettl-style SJT
**Scenario:** ...
**Question:** ...
**Type:** mcq
**Options:**
- A) ...
- B) ...
---`}
              </pre>
              <a
                href="/staff/case-library/template"
                className="inline-flex items-center gap-1.5 mt-2 font-semibold text-accent-dark hover:underline"
              >
                <Icon name="file" className="w-3.5 h-3.5" />
                Download example .md template
              </a>
              <p className="mt-3">
                <span className="font-semibold text-foreground">Freeform document?</span> If your file doesn&apos;t
                follow this layout — research notes, an existing case bank in its own format — turn on AI-assisted
                extraction below and pick an engine; it&apos;ll read the document and pull out usable cases itself.
              </p>
            </details>
            <form action={uploadCasesFromFile} encType="multipart/form-data" className="space-y-3">
              <input
                type="file"
                name="file"
                accept=".xlsx,.xls,.docx,.txt,.md,.markdown"
                required
                className="w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-accent-soft file:text-accent-dark file:font-semibold file:text-xs bg-background border border-line rounded-xl px-2 py-1.5"
              />
              <div>
                <label className="text-[11px] font-semibold text-muted block mb-1">
                  Default competency (used when a case doesn&apos;t specify one)
                </label>
                <select
                  name="default_competency_id"
                  className="w-full bg-background border border-line rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">None — skip unmatched rows</option>
                  {compList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.category})
                    </option>
                  ))}
                </select>
              </div>
              {availableEngines.length > 0 && (
                <div>
                  <label className="text-[11px] font-semibold text-muted block mb-1">
                    AI-assisted extraction (Word/text/Markdown only, used only if the structured format above finds
                    nothing)
                  </label>
                  <select
                    name="ai_engine"
                    defaultValue=""
                    className="w-full bg-background border border-line rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">Off — structured format only</option>
                    {availableEngines.map((e) => (
                      <option key={e.key} value={e.key}>
                        Try with {e.display_name} if needed
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button className="w-full bg-accent text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-accent-dark transition-colors">
                Upload &amp; import
              </button>
            </form>
          </Card>

                    {methodologyTags.length > 0 && (
            <Card className="p-5">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint mb-2">Filter by methodology</p>
              <div className="flex flex-wrap gap-1.5">
                {methodologyTags.map((t) => (
                  <Link
                    key={t}
                    href={`/staff/case-library?tag=${encodeURIComponent(t)}`}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset transition-colors ${
                      tagFilter === t ? "bg-accent text-white ring-accent" : "bg-accent-soft text-accent-dark ring-accent/20 hover:ring-accent/40"
                    }`}
                  >
                    {t}
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
