// Scout's scripted navigation/intent matcher -- instant, free, no API call.
// Maps common phrasings to a real destination route + a short explanation of
// what the user will find there, scoped to what each role can actually see.
// If nothing matches with reasonable confidence, the caller falls back to
// the Kimi-powered open-ended answer (see scout-chat.ts).

export type ScoutRole = "visitor" | "candidate" | "staff" | "decision_maker" | "admin";

export type ScoutIntent = {
  id: string;
  roles: ScoutRole[];
  href: string;
  label: string; // destination menu label, shown as "Opening <label>..."
  explain: string; // one-line explanation of what to do there
  keywords: string[]; // lowercase phrases/words that should trigger this intent
};

export const SCOUT_INTENTS: ScoutIntent[] = [
  // ---------- Staff ----------
  {
    id: "staff-home",
    roles: ["staff"],
    href: "/staff",
    label: "Home",
    explain: "Your pipeline at a glance: candidates in flight, scores awaiting review, and the published-assessment count.",
    keywords: ["home", "dashboard", "overview", "pipeline at a glance"],
  },
  {
    id: "staff-new-assessment",
    roles: ["staff"],
    href: "/staff/builder",
    label: "Assessment Builder",
    explain: "Click \"New assessment\", give it a title and purpose (hiring, promotion, or development), then add sections mapped to the competency framework.",
    keywords: ["new assessment", "create assessment", "build assessment", "make an assessment", "start an assessment", "builder"],
  },
  {
    id: "staff-invite-candidate",
    roles: ["staff"],
    href: "/staff/people",
    label: "People & Access",
    explain: "In People & Access, use \"Add a candidate\" and pick an assessment package -- it creates the account, assigns the assessment, and emails the invite in one step.",
    keywords: ["invite candidate", "invite a candidate", "assign assessment", "send invite", "add candidate"],
  },
  {
    id: "staff-candidates",
    roles: ["staff"],
    href: "/staff/reports/candidates",
    label: "Candidates",
    explain: "Every assessment attempt across the org, with Role Fit scores and filters by status, department, or vacancy.",
    keywords: ["candidates", "find a candidate", "candidate list", "who applied", "search candidate"],
  },
  {
    id: "staff-review-queue",
    roles: ["staff"],
    href: "/staff/reports/candidates?status=scored",
    label: "Candidates awaiting review",
    explain: "Filtered to candidates the AI has scored but a human hasn't confirmed yet -- start here to clear the review queue.",
    keywords: ["review queue", "awaiting review", "pending review", "need review", "unreviewed"],
  },
  {
    id: "staff-reports",
    roles: ["staff"],
    href: "/staff/reports",
    label: "Reports & Analytics",
    explain: "Score distributions, pipeline funnels, and competency breakdowns across every assessment.",
    keywords: ["reports", "analytics", "insights", "charts", "statistics"],
  },
  {
    id: "staff-people",
    roles: ["staff"],
    href: "/staff/people",
    label: "People & Access",
    explain: "Add staff, edit roles and departments, deactivate accounts, and see the admin audit log.",
    keywords: ["people", "add a user", "add staff", "manage users", "deactivate", "roles and access", "invite staff"],
  },
  {
    id: "staff-case-library",
    roles: ["staff"],
    href: "/staff/case-library",
    label: "Case Library",
    explain: "Browse or upload case-study material used to generate scenario questions.",
    keywords: ["case library", "case studies", "upload case", "scenario bank"],
  },
  {
    id: "staff-compare",
    roles: ["staff"],
    href: "/staff/compare",
    label: "Compare candidates",
    explain: "Put two or more candidates side by side across competency scores.",
    keywords: ["compare candidates", "side by side", "compare scores"],
  },
  {
    id: "staff-settings",
    roles: ["staff"],
    href: "/staff/settings",
    label: "Settings",
    explain: "Configure the AI generation/scoring engine (including the Kimi API key) and other workspace settings.",
    keywords: ["settings", "configure kimi", "api key", "engine settings"],
  },

  // ---------- Decision maker ----------
  {
    id: "decision-home",
    roles: ["decision_maker"],
    href: "/decision",
    label: "Assigned candidates",
    explain: "Every candidate report you've been assigned to weigh in on, with their current review status.",
    keywords: ["home", "my candidates", "assigned candidates", "dashboard"],
  },

  // ---------- Candidate ----------
  {
    id: "candidate-home",
    roles: ["candidate"],
    href: "/candidate",
    label: "Home",
    explain: "Your invited assessments and a summary of what's due.",
    keywords: ["home", "dashboard", "my page"],
  },
  {
    id: "candidate-assessments",
    roles: ["candidate"],
    href: "/candidate/assessments",
    label: "My Assessments",
    explain: "Start or resume an assessment you've been invited to. Answers save automatically as you go.",
    keywords: ["my assessments", "start assessment", "take assessment", "resume assessment", "continue assessment"],
  },
  {
    id: "candidate-results",
    roles: ["candidate"],
    href: "/candidate/results",
    label: "My Results",
    explain: "Your Role Fit score and competency breakdown for completed assessments.",
    keywords: ["my results", "my score", "see my score", "results"],
  },
  {
    id: "candidate-signoffs",
    roles: ["candidate"],
    href: "/candidate/signoffs",
    label: "Sign-off requests",
    explain: "Promotion sign-off requests waiting on you as a manager.",
    keywords: ["sign off", "sign-off", "manager sign off", "approve promotion"],
  },

  // ---------- Admin ----------
  {
    id: "admin-home",
    roles: ["admin"],
    href: "/admin",
    label: "Admin Dashboard",
    explain: "System-wide health, usage, and governance at a glance.",
    keywords: ["admin dashboard", "admin home"],
  },
  {
    id: "admin-users",
    roles: ["admin"],
    href: "/admin/users",
    label: "Users",
    explain: "Every account on the system -- search, edit roles, deactivate, or GDPR-anonymize.",
    keywords: ["users", "manage users", "all users", "find a user"],
  },
  {
    id: "admin-roles",
    roles: ["admin"],
    href: "/admin/roles",
    label: "Roles & Permissions",
    explain: "The permission matrix controlling what each role can do, plus per-user overrides.",
    keywords: ["roles", "permissions", "role matrix", "who can do what"],
  },
  {
    id: "admin-audit",
    roles: ["admin"],
    href: "/admin/audit",
    label: "Audit Logs",
    explain: "A full trail of administrative actions taken across the system.",
    keywords: ["audit", "audit log", "who did what", "activity log"],
  },
  {
    id: "admin-security",
    roles: ["admin"],
    href: "/admin/security",
    label: "Security",
    explain: "Security posture, sessions, and access controls.",
    keywords: ["security"],
  },
  {
    id: "admin-ai-governance",
    roles: ["admin"],
    href: "/admin/ai-governance",
    label: "AI Governance",
    explain: "Oversight of the AI scoring/generation engines and their guardrails.",
    keywords: ["ai governance", "ai settings", "kimi governance"],
  },
  {
    id: "admin-data-governance",
    roles: ["admin"],
    href: "/admin/data-governance",
    label: "Data Governance",
    explain: "Retention rules, GDPR anonymization, and legal holds.",
    keywords: ["data governance", "gdpr", "retention", "anonymize"],
  },

  // ---------- Visitor (public/marketing site) ----------
  {
    id: "visitor-how-it-works",
    roles: ["visitor"],
    href: "/#how",
    label: "How it works",
    explain: "The three-step loop: build assessments from the competency framework, candidates respond and get AI-scored, humans confirm the decision.",
    keywords: ["how it works", "how does this work", "process"],
  },
  {
    id: "visitor-framework",
    roles: ["visitor"],
    href: "/#framework",
    label: "Competency framework",
    explain: "The governed 37-competency model behind every assessment, organized into Core, Leadership, and Functional categories.",
    keywords: ["competency framework", "competencies", "framework", "what do you measure"],
  },
  {
    id: "visitor-features",
    roles: ["visitor"],
    href: "/#features",
    label: "Platform",
    explain: "What each portal (candidate, recruiter, hiring manager, HR admin) can do.",
    keywords: ["features", "platform", "what can it do"],
  },
  {
    id: "visitor-signup",
    roles: ["visitor"],
    href: "/signup",
    label: "Candidate sign-up",
    explain: "If you've been invited to an assessment, this is where you set up your account.",
    keywords: ["sign up", "signup", "create account", "candidate account", "i'm a candidate"],
  },
  {
    id: "visitor-login",
    roles: ["visitor"],
    href: "/login",
    label: "Log in",
    explain: "Log in to your candidate or staff workspace.",
    keywords: ["log in", "login", "sign in"],
  },
];

/** Very small keyword-overlap scorer -- fast, deterministic, no API call. */
export function matchScoutIntent(query: string, role: ScoutRole): ScoutIntent | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  const candidates = SCOUT_INTENTS.filter((i) => i.roles.includes(role));
  let best: { intent: ScoutIntent; score: number } | null = null;

  for (const intent of candidates) {
    for (const kw of intent.keywords) {
      if (q.includes(kw)) {
        const score = kw.length; // longer/more-specific phrase match wins
        if (!best || score > best.score) best = { intent, score };
      }
    }
  }

  // Require a reasonably substantial match (avoid 3-letter words firing on noise)
  if (best && best.score >= 4) return best.intent;
  return null;
}
