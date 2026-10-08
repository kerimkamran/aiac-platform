// The publish checklist shown on the draft and preview pages. Blocking items
// disable Publish; warnings do not. publish_assessment() in the database
// enforces the blocking rules again, so this is for the reviewer, not the gate.

export type PublishCheck = { label: string; ok: boolean; blocking: boolean };

export type CheckQuestion = { question_type: string; options: { correct?: boolean; text: string }[] | null };
export type CheckSection = { target_score: number | null; questions: CheckQuestion[] };

export function publishChecks(input: { sections: CheckSection[]; hasPosition: boolean }): PublishCheck[] {
  const { sections, hasPosition } = input;
  const questions = sections.flatMap((s) => s.questions);
  const questionCount = questions.length;
  const badMcq = questions.filter((q) => {
    if (q.question_type !== "mcq") return false;
    const opts = (q.options || []).filter((o) => o.text && o.text.trim());
    return opts.length < 2 || opts.filter((o) => o.correct).length !== 1;
  }).length;

  return [
    {
      label: `${questionCount} question${questionCount === 1 ? "" : "s"} in ${sections.length} section${sections.length === 1 ? "" : "s"}`,
      ok: questionCount > 0,
      blocking: true,
    },
    {
      label: "Every multiple-choice question has at least two options and exactly one correct answer",
      ok: badMcq === 0,
      blocking: true,
    },
    {
      label: "Every section has at least one question",
      ok: sections.every((s) => s.questions.length > 0),
      blocking: false,
    },
    {
      label: "Every section has a target score",
      ok: sections.every((s) => s.target_score != null),
      blocking: false,
    },
    { label: "Linked to a position", ok: hasPosition, blocking: false },
  ];
}
