import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreTextResponse, type CompetencyContext, type ScoreResult, type ScoringEngine } from "@/lib/scoring";
import { isLevelKey } from "@/lib/levels";

/**
 * Scores one submitted attempt. It runs on the server with the service-role
 * client (the candidate's own session can no longer write scores), and it is
 * safe to run again after a partial failure: questions already scored are kept,
 * and only an attempt still in "submitted" can become "scored".
 *
 * Multiple-choice answers are graded here, from the stored options, so the
 * correct option never reaches the browser. Written answers go to the AI engine
 * a few at a time, each with a time limit, and fall back to the plain
 * length-and-structure scorer if the engine is slow or down (E-07).
 */

const TEXT_SCORE_TIMEOUT_MS = 25_000;
const TEXT_SCORE_CONCURRENCY = 4;

type QuestionRow = {
  id: string;
  section_id: string;
  question_type: string;
  prompt: string;
  weight: number | null;
  competency_id: string | null;
  options: { key: string; text?: string; correct?: boolean }[] | null;
};
type SectionRow = { id: string; competency_id: string; sequence: number };

export type ScoreAttemptResult = { ok: true; overallScore: number } | { ok: false; error: string };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  return Promise.race([promise, new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms))]);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function scoreAttempt(
  db: SupabaseClient,
  input: { candidateAssessmentId: string; answers: Record<string, string>; tabSwitchCount?: number }
): Promise<ScoreAttemptResult> {
  const caId = input.candidateAssessmentId;

  const { data: ca } = await db
    .from("candidate_assessments")
    .select("id, assessment_id, status, assessments(engine, target_level)")
    .eq("id", caId)
    .maybeSingle();
  if (!ca) return { ok: false, error: "Assessment not found." };
  if (ca.status === "scored" || ca.status === "reviewed") return { ok: true, overallScore: 0 };

  const meta = ca.assessments as unknown as { engine: string | null; target_level: string | null } | null;
  const targetLevel = isLevelKey(meta?.target_level) ? meta!.target_level : null;
  const engine: ScoringEngine | null =
    meta?.engine === "claude" || meta?.engine === "fugu" || meta?.engine === "kimi" ? meta.engine : null;

  let apiKey: string | null = null;
  if (engine) {
    const { data } = await db.rpc("get_engine_api_key_for_scoring", { p_engine_key: engine });
    apiKey = (data as string | null) || null;
  }

  const [{ data: sectionRows }, existing] = await Promise.all([
    db.from("assessment_sections").select("id, competency_id, sequence").eq("assessment_id", ca.assessment_id).order("sequence"),
    db.from("candidate_responses").select("question_id, score").eq("candidate_assessment_id", caId),
  ]);
  const sections = (sectionRows || []) as SectionRow[];
  if (sections.length === 0) return { ok: false, error: "This assessment has no questions." };

  const { data: questionRows } = await db
    .from("questions")
    .select("id, section_id, question_type, prompt, weight, competency_id, options")
    .in("section_id", sections.map((s) => s.id))
    .order("sequence");
  const questions = (questionRows || []) as QuestionRow[];
  const sectionCompetency = new Map(sections.map((s) => [s.id, s.competency_id]));

  const stored = new Map<string, number>();
  for (const r of existing.data || []) {
    if (r.score !== null) stored.set(r.question_id as string, Number(r.score));
  }

  // Competency context for written-answer grading.
  const competencyIds = Array.from(
    new Set(questions.map((q) => q.competency_id || sectionCompetency.get(q.section_id)).filter(Boolean))
  ) as string[];
  const competencyMap = new Map<string, CompetencyContext>();
  if (competencyIds.length > 0) {
    const [{ data: comps }, { data: indicators }] = await Promise.all([
      db.from("competencies").select("id, name, description").in("id", competencyIds),
      db.from("competency_indicators").select("competency_id, level, indicator_text").in("competency_id", competencyIds),
    ]);
    for (const c of comps || []) {
      competencyMap.set(c.id, { name: c.name, description: c.description, indicators: [], targetLevel });
    }
    for (const i of indicators || []) {
      competencyMap.get(i.competency_id)?.indicators.push({ level: i.level, indicator_text: i.indicator_text });
    }
  }

  const scores = new Map<string, number>(stored);
  const toScore = questions.filter((q) => !stored.has(q.id));

  await mapLimit(toScore, TEXT_SCORE_CONCURRENCY, async (q) => {
    const answer = String(input.answers[q.id] ?? "");

    if (q.question_type === "mcq") {
      const selected = answer || null;
      const correct = (q.options || []).find((o) => o.correct === true)?.key ?? null;
      const score = selected !== null && selected === correct ? 100 : 0;
      const rationale =
        score === 100
          ? `Selected option ${selected}, matching the validated correct answer.`
          : `Selected option ${selected ?? "(none)"}; validated correct answer is ${correct ?? "unknown"}.`;
      const { error } = await db.from("candidate_responses").insert({
        candidate_assessment_id: caId,
        question_id: q.id,
        selected_option: selected,
        score,
        ai_rationale: rationale,
      });
      if (!error || error.code === "23505") scores.set(q.id, score);
      return;
    }

    const competencyId = q.competency_id || sectionCompetency.get(q.section_id) || "";
    const competency: CompetencyContext = competencyMap.get(competencyId) || {
      name: "General",
      description: null,
      indicators: [],
      targetLevel,
    };
    const run = (useEngine: ScoringEngine | null, key: string | null): Promise<ScoreResult> =>
      scoreTextResponse({ questionPrompt: q.prompt, responseText: answer, competency, engine: useEngine, apiKey: key });
    let scored: ScoreResult;
    const first = await withTimeout(run(engine, apiKey), TEXT_SCORE_TIMEOUT_MS);
    if (first === "timeout") {
      // The engine is too slow: use the plain scorer and make sure a person looks at it.
      const fallback = await run(null, null);
      scored = { ...fallback, needsReview: true, rationale: `${fallback.rationale} (The AI scorer did not answer in time.)` };
    } else {
      scored = first;
    }
    const { error } = await db.from("candidate_responses").insert({
      candidate_assessment_id: caId,
      question_id: q.id,
      response_text: answer,
      score: scored.score,
      ai_rationale: scored.rationale,
      needs_review: scored.needsReview,
    });
    if (!error || error.code === "23505") scores.set(q.id, scored.score);
  });

  // Totals per competency and overall, weighted by question weight.
  const totals = new Map<string, { weighted: number; weight: number }>();
  let overallWeighted = 0;
  let overallWeight = 0;
  for (const q of questions) {
    const s = scores.get(q.id);
    if (s === undefined) continue;
    const w = Number(q.weight) || 1;
    const compId = sectionCompetency.get(q.section_id) as string;
    const t = totals.get(compId) || { weighted: 0, weight: 0 };
    t.weighted += s * w;
    t.weight += w;
    totals.set(compId, t);
    overallWeighted += s * w;
    overallWeight += w;
  }
  if (scores.size < questions.length) {
    return { ok: false, error: "Some answers could not be recorded." };
  }

  for (const [competencyId, t] of totals) {
    const score = t.weight > 0 ? t.weighted / t.weight : 0;
    const { error } = await db.from("candidate_competency_scores").upsert(
      {
        candidate_assessment_id: caId,
        competency_id: competencyId,
        score: Math.round(score * 10) / 10,
        level: score >= 85 ? "Exceeds" : score >= 70 ? "Fully Meets" : score >= 50 ? "Partially Meets" : "Does Not Meet",
      },
      { onConflict: "candidate_assessment_id,competency_id" }
    );
    if (error) return { ok: false, error: "The scores could not be saved." };
  }

  const overallScore = overallWeight > 0 ? Math.round((overallWeighted / overallWeight) * 10) / 10 : 0;
  const update: Record<string, unknown> = { status: "scored", overall_score: overallScore };
  if (typeof input.tabSwitchCount === "number") update.tab_switch_count = input.tabSwitchCount;
  const { error: finishError } = await db
    .from("candidate_assessments")
    .update(update)
    .eq("id", caId)
    .eq("status", "submitted");
  if (finishError) return { ok: false, error: "The result could not be saved." };

  return { ok: true, overallScore };
}

/**
 * Recalculates the competency scores and the overall score from the answer
 * scores now stored (after a reviewer changed one). Uses the same weighting as
 * the first scoring pass. Server-side, with the service-role client.
 */
export async function recomputeTotals(db: SupabaseClient, caId: string): Promise<{ ok: boolean; overallScore?: number; error?: string }> {
  const { data: rows, error } = await db
    .from("candidate_responses")
    .select("score, questions(weight, competency_id, assessment_sections(competency_id))")
    .eq("candidate_assessment_id", caId);
  if (error || !rows) return { ok: false, error: "The answers could not be read." };

  type Row = {
    score: number | null;
    questions: { weight: number | null; competency_id: string | null; assessment_sections: { competency_id: string | null } | null } | null;
  };
  const totals = new Map<string, { weighted: number; weight: number }>();
  let overallWeighted = 0;
  let overallWeight = 0;
  for (const r of rows as unknown as Row[]) {
    if (r.score === null || !r.questions) continue;
    const w = Number(r.questions.weight) || 1;
    const compId = r.questions.assessment_sections?.competency_id || r.questions.competency_id;
    overallWeighted += Number(r.score) * w;
    overallWeight += w;
    if (!compId) continue;
    const t = totals.get(compId) || { weighted: 0, weight: 0 };
    t.weighted += Number(r.score) * w;
    t.weight += w;
    totals.set(compId, t);
  }

  for (const [competencyId, t] of totals) {
    const score = t.weight > 0 ? t.weighted / t.weight : 0;
    const { error: upErr } = await db.from("candidate_competency_scores").upsert(
      {
        candidate_assessment_id: caId,
        competency_id: competencyId,
        score: Math.round(score * 10) / 10,
        level: score >= 85 ? "Exceeds" : score >= 70 ? "Fully Meets" : score >= 50 ? "Partially Meets" : "Does Not Meet",
      },
      { onConflict: "candidate_assessment_id,competency_id" }
    );
    if (upErr) return { ok: false, error: "The totals could not be saved." };
  }
  const overallScore = overallWeight > 0 ? Math.round((overallWeighted / overallWeight) * 10) / 10 : 0;
  const { error: finErr } = await db.from("candidate_assessments").update({ overall_score: overallScore }).eq("id", caId);
  if (finErr) return { ok: false, error: "The overall score could not be saved." };
  return { ok: true, overallScore };
}
