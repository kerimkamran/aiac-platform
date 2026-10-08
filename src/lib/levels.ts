// The five generic role levels the builder asks about, and what each one
// means for generation and scoring. This table is where the old roadmap's
// rigor ideas live now: competing goods, pressure, stakeholder navigation and
// experience calibration are guidance per level, not separate projects.
//
// Pass marks are defaults and need HR sign-off before they are relied on
// (see the open items in the AIAC Assessment Builder plan).

export const LEVEL_KEYS = ["entry", "senior", "manager", "director", "c_level"] as const;
export type LevelKey = (typeof LEVEL_KEYS)[number];

export type LevelInfo = {
  label: string;
  // Indicator tiers to emphasise. All indicators are still sent to the model,
  // tagged "target" or "reference" for the level.
  targetTiers: ("Basic" | "Skilled" | "Expert")[];
  passMark: number;
  // Scenario guidance added to the generation prompt.
  scenarioGuidance: string;
  // What a strong answer must show at this level; used by the scoring prompt.
  scoringBar: string;
};

export const LEVELS: Record<LevelKey, LevelInfo> = {
  entry: {
    label: "Entry / Specialist",
    targetTiers: ["Basic", "Skilled"],
    passMark: 60,
    scenarioGuidance:
      "Own work with clear information. One stakeholder at a time. No people management, budgets or P&L. The right answer should be reachable with careful reasoning from the case itself.",
    scoringBar:
      "Clear, specific behaviour in the candidate's own work. Basic behaviour is enough for a pass; Skilled behaviour is the strong mark.",
  },
  senior: {
    label: "Senior Specialist",
    targetTiers: ["Skilled"],
    passMark: 70,
    scenarioGuidance:
      "Influence without authority across teams. Some ambiguity in the information. Two or three stakeholders with different priorities. Light time pressure.",
    scoringBar:
      "Skilled behaviour: the candidate influences others without formal authority, and considers more than their own team.",
  },
  manager: {
    label: "Manager",
    targetTiers: ["Skilled", "Expert"],
    passMark: 70,
    scenarioGuidance:
      "Leading a team. Competing priorities that cannot all be met. Time pressure. Stakeholder conflict inside the team and with a peer function. Some budget or resource trade-off.",
    scoringBar:
      "Skilled behaviour at minimum for a pass. Expert behaviour shows the candidate weighing team, peer and business trade-offs explicitly.",
  },
  director: {
    label: "Director / Head",
    targetTiers: ["Expert"],
    passMark: 75,
    scenarioGuidance:
      "Competing goods: every option has a real cost and at least two of the options are defensible. Several functions affected. Budget or P&L figures that the candidate must use. Political pressure and hidden agendas among stakeholders. The candidate must show what each option gives up.",
    scoringBar:
      "Expert behaviour: the answer names the trade-offs of the options it rejects, anticipates stakeholder reactions, and reflects real experience of owning results (budget, team, or P&L).",
  },
  c_level: {
    label: "C-Level",
    targetTiers: ["Expert"],
    passMark: 80,
    scenarioGuidance:
      "Board, regulator and enterprise-wide trade-offs. Long horizon. Reputational and legal risk. Decisions that cannot be reversed quickly. The candidate must weigh shareholders, employees, customers and the public.",
    scoringBar:
      "Expert behaviour at enterprise scale: decisions weigh long-term consequences, governance and reputation, and the answer shows judgement about what to escalate and what to own.",
  },
};

export function isLevelKey(value: unknown): value is LevelKey {
  return typeof value === "string" && (LEVEL_KEYS as readonly string[]).includes(value);
}

// Levels at which the Leadership competency category is relevant.
export function includesLeadership(level: LevelKey): boolean {
  return level === "manager" || level === "director" || level === "c_level";
}
