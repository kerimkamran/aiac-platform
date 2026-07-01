// Phase-1 scoring engine (AIAC-SRS-P4 Product Vision notes real LLM-based scoring;
// this is a deterministic, rule-based simulation for the MVP so the full
// submit -> score -> review pipeline is genuinely functional end-to-end.)

export type ScoreResult = { score: number; rationale: string; needsReview: boolean };

const OUTCOME_SIGNALS = [
  "result",
  "achiev",
  "improv",
  "increas",
  "reduc",
  "success",
  "impact",
  "outcome",
  "deliver",
];

const ACTION_SIGNALS = [
  "led",
  "implement",
  "develop",
  "organiz",
  "initiat",
  "collaborat",
  "resolv",
  "communicat",
  "propose",
  "analyz",
];

export function scoreTextResponse(text: string): ScoreResult {
  const clean = (text || "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lower = clean.toLowerCase();

  const outcomeHits = OUTCOME_SIGNALS.filter((s) => lower.includes(s)).length;
  const actionHits = ACTION_SIGNALS.filter((s) => lower.includes(s)).length;

  let score = 30;
  if (wordCount >= 25) score += 15;
  if (wordCount >= 60) score += 10;
  score += Math.min(outcomeHits, 3) * 10;
  score += Math.min(actionHits, 3) * 5;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const needsReview = score < 55 || wordCount < 15;

  let rationale = `Phase-1 rule-based scoring: ${wordCount} words; ${actionHits} action-oriented and ${outcomeHits} outcome-oriented signal(s) detected against the competency's Skilled-level behavioural anchors. This is a simulated engine (SRS Part 4 specifies the production LLM-based engine as Product Vision) — directional only.`;
  if (needsReview) {
    rationale += " Flagged for human reviewer confirmation (human-in-the-loop requirement, Part 4).";
  }

  return { score, rationale, needsReview };
}

export function scoreMcqResponse(
  options: { key: string; text: string; correct?: boolean }[],
  selectedKey: string | null
): ScoreResult {
  const correct = options.find((o) => o.correct);
  const selected = options.find((o) => o.key === selectedKey);
  const isCorrect = !!selected?.correct;
  return {
    score: isCorrect ? 100 : 0,
    rationale: isCorrect
      ? `Selected option ${selectedKey}, matching the validated correct answer.`
      : `Selected option ${selectedKey ?? "(none)"}; validated correct answer is ${correct?.key ?? "unknown"}.`,
    needsReview: false,
  };
}
