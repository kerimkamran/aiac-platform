// Scout's open-ended fallback -- used only when the scripted intent matcher
// (scout-intents.ts) finds no confident navigation match. Reuses the same
// Kimi (Moonshot) engine config as report-chat.ts (generation_engines table +
// get_engine_api_key() RPC) -- no new secret-storage mechanism. Unlike the
// report chat, this has no access to any single candidate's private data --
// it only knows the app's structure, so it's safe to expose to anonymous
// visitors as well as every logged-in role.

import type { ScoutRole } from "@/lib/scout-intents";

export type ScoutChatMessage = { role: "user" | "assistant"; content: string };

const ROLE_BLURB: Record<ScoutRole, string> = {
  visitor: "an anonymous visitor on the public marketing site who has not logged in",
  candidate: "a candidate who has been invited to complete one or more competency assessments",
  staff: "an HR/recruiting staff member (recruiter, hiring manager, HR admin, or org admin) building assessments and reviewing candidates",
  decision_maker: "a decision maker who has been assigned specific candidate reports to weigh in on",
  admin: "a system administrator with access to the full Admin Panel (users, roles, audit, security, governance)",
};

const ROLE_MAP: Record<ScoutRole, string> = {
  visitor: "Home /, How it works /#how, Competency framework /#framework, Platform /#features, Sign up /signup, Log in /login.",
  candidate: "Home /candidate, My Assessments /candidate/assessments, My Results /candidate/results, Sign-off requests /candidate/signoffs (only if they manage direct reports).",
  staff: "Home /staff, Candidates /staff/candidates, Reports & Analytics /staff/reports, Assessment Builder /staff/builder, People & Access /staff/people, Settings /staff/settings, Case Library /staff/case-library, Compare /staff/compare.",
  decision_maker: "Assigned candidates /decision.",
  admin: "Admin Dashboard /admin, Users /admin/users, Roles & Permissions /admin/roles, Organizations /admin/organizations, Approvals /admin/approvals, Audit Logs /admin/audit, Notifications /admin/notifications, Security /admin/security, AI Governance /admin/ai-governance, Data Governance /admin/data-governance, API /admin/api-docs.",
};

function buildSystemPrompt(role: ScoutRole): string {
  return `You are Scout, the in-app guide for Vantage -- Azerconnect Group's AI-powered competency assessment platform. You are talking to ${ROLE_BLURB[role]}.

Your job: answer questions about how to use the app and point people to the right place. Be brief and concrete -- name the actual menu item and, if useful, say "I've opened it for you" style phrasing since the app can navigate for the user when you name a page.

Pages this person can currently see:
${ROLE_MAP[role]}

Vantage in one paragraph: it turns Azerconnect's governed 37-competency framework (organised into Core, Leadership, and Functional categories, each measured on four proficiency bands from Does Not Meet to Exceeds) into structured assessments. Candidates complete guided, timed assessments; each answer is scored against competency anchors with a written rationale (MCQ scored exactly, free-text scored by a rule-based heuristic in this phase, not a full LLM grading the substance -- so free-text scores are directional and a human should read the actual answer too). A human reviewer always confirms shortlist/hold/reject (or promotion/development) decisions -- the AI proposes, people decide.

Keep answers to 2-4 sentences unless the person clearly wants more detail. If asked something outside what you know (e.g. a specific candidate's private data, account-specific troubleshooting only an admin can see), say so plainly and suggest who to ask, rather than guessing.`;
}

export async function runScoutChat(apiKey: string, role: ScoutRole, history: ScoutChatMessage[]): Promise<string> {
  const res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "moonshot-v1-32k",
      temperature: 0.4,
      messages: [{ role: "system", content: buildSystemPrompt(role) }, ...history],
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
