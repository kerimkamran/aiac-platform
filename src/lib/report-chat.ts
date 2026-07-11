// "Discuss with AI" report chat -- lets staff/decision makers ask questions
// about a candidate's assessment report or draft follow-up content (interview
// questions, development suggestions, decision rationale), grounded strictly
// in that candidate_assessment's actual data. Uses the Kimi (Moonshot) engine
// via the existing generation_engines/get_engine_api_key() infra -- same key
// management already used for assessment generation and Case Library, no new
// secret-storage mechanism.

export type ReportChatMessage = { role: "user" | "assistant"; content: string };

export type ReportContext = {
  candidateName: string;
  assessmentTitle: string;
  purpose: "hiring" | "promotion" | "development";
  overallScore: number | null;
  competencies: { name: string; category: string; score: number; level: string }[];
  responses: {
    competencyName: string | null;
    prompt: string | null;
    answer: string;
    score: number;
    rationale: string;
  }[];
  benchmark: { percentile: number | null; peerAvg: number | null; peerCount: number } | null;
  boxLabel: string | null;
  priorDecisions: { decision: string; comment: string | null; reviewer: string | null }[];
};

function buildSystemPrompt(ctx: ReportContext): string {
  const purposeNoun =
    ctx.purpose === "hiring" ? "hiring candidate" : ctx.purpose === "promotion" ? "promotion candidate" : "employee";

  const competencyLines = ctx.competencies
    .map((c) => `- ${c.name} (${c.category}): ${Math.round(c.score)}/100, level "${c.level}"`)
    .join("\n") || "(no scored competencies yet)";

  const responseLines =
    ctx.responses
      .map((r, i) => {
        const q = r.prompt ? `Q: ${r.prompt}` : "Q: (prompt unavailable)";
        const comp = r.competencyName ? ` [${r.competencyName}]` : "";
        return `${i + 1}.${comp} ${q}\n   Answer: "${r.answer}"\n   Score: ${r.score}/100 -- Rationale: ${r.rationale}`;
      })
      .join("\n\n") || "(no response evidence on file)";

  const benchmarkLine =
    ctx.benchmark && ctx.benchmark.percentile !== null
      ? `Scored higher than ${ctx.benchmark.percentile}% of ${ctx.benchmark.peerCount} peers assessed on the same assessment (peer average ${ctx.benchmark.peerAvg}).`
      : "No peer benchmark available yet (too few peers scored on this assessment).";

  const priorDecisionLines =
    ctx.priorDecisions.length > 0
      ? ctx.priorDecisions.map((d) => `- ${d.decision}${d.reviewer ? ` by ${d.reviewer}` : ""}${d.comment ? `: "${d.comment}"` : ""}`).join("\n")
      : "(no decisions recorded yet)";

  return `You are an assessment-report assistant helping an HR reviewer or decision maker at Azerconnect Group think through a specific ${purposeNoun}'s AI Assessment Center report. You are NOT a general-purpose chatbot -- you only discuss this report.

Ground every answer strictly in the report data below. Never invent scores, quotes, or facts not present here. If asked something the data doesn't cover, say so plainly rather than guessing.

You may be asked to:
1. Answer questions about the report (e.g. "why did they score low on X", "how does this compare to the role bar", "what stands out here")
2. Draft follow-up content: interview follow-up questions probing a specific weak area, development plan suggestions tied to a specific competency gap, or a short written decision rationale summarizing the case for/against a decision

Keep answers concise and specific -- reference actual competency names, scores, and quoted response text rather than generic HR language. Do not make the hiring/promotion/development decision yourself; you inform the human reviewer's judgment, you don't replace it.

=== REPORT DATA ===
Candidate: ${ctx.candidateName}
Assessment: ${ctx.assessmentTitle} (purpose: ${ctx.purpose})
Overall Role Fit score: ${ctx.overallScore !== null ? `${Math.round(ctx.overallScore)}/100` : "not yet scored"}
${ctx.boxLabel ? `Talent Matrix placement: ${ctx.boxLabel}` : ""}

Competency scores:
${competencyLines}

Benchmark: ${benchmarkLine}

Response evidence (answer + AI-assigned score + rationale):
${responseLines}

Prior reviewer decisions on this report:
${priorDecisionLines}
=== END REPORT DATA ===`;
}

import type { SupabaseClient } from "@supabase/supabase-js";

async function loadKimiKey(supabase: SupabaseClient) {
  const { data: engine } = await supabase.from("generation_engines").select("enabled").eq("key", "kimi").maybeSingle();
  const { data: apiKey } = await supabase.rpc("get_engine_api_key", { p_engine_key: "kimi" });
  if (!engine || !engine.enabled || !apiKey) {
    throw new Error("The Kimi AI engine isn't configured. Add an API key and enable it in Settings first.");
  }
  return apiKey as string;
}

export async function runReportChat(
  supabase: SupabaseClient,
  ctx: ReportContext,
  history: ReportChatMessage[]
): Promise<string> {
  const apiKey = await loadKimiKey(supabase);

  const res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "moonshot-v1-32k",
      temperature: 0.5,
      messages: [{ role: "system", content: buildSystemPrompt(ctx) }, ...history],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Kimi API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Kimi returned no message content.");
  return text.trim();
}
