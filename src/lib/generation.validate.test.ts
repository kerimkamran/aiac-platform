import { describe, expect, it } from "vitest";
import { validateGenerated } from "./generation";

const four = (correctIndex: number | null) =>
  ["A", "B", "C", "D"].map((t, i) => ({ text: `option ${t}`, correct: i === correctIndex }));

describe("validateGenerated", () => {
  it("keeps a well-formed MCQ and never marks an option correct on its own", () => {
    const { assessment, report } = validateGenerated({
      sections: [{ competencyCode: "C1", questions: [{ type: "mcq", prompt: "Q?", options: four(2) }] }],
    });
    const q = assessment.sections[0].questions[0];
    expect(q.options).toHaveLength(4);
    expect(q.options!.filter((o) => o.correct)).toHaveLength(1);
    expect(report.droppedQuestions).toBe(0);
  });

  it("drops an MCQ with no correct answer instead of guessing option A", () => {
    const { assessment, report } = validateGenerated({
      sections: [{ competencyCode: "C1", questions: [{ type: "mcq", prompt: "Q?", options: four(null) }] }],
    });
    expect(assessment.sections).toHaveLength(0);
    expect(report.droppedQuestions).toBe(1);
    expect(report.droppedReasons[0]).toMatch(/exactly one correct/);
  });

  it("drops an MCQ with three options", () => {
    const { report } = validateGenerated({
      sections: [{ competencyCode: "C1", questions: [{ type: "mcq", prompt: "Q?", options: four(0).slice(0, 3) }] }],
    });
    expect(report.droppedQuestions).toBe(1);
    expect(report.droppedReasons[0]).toMatch(/3 options/);
  });

  it("drops an MCQ with two correct answers", () => {
    const opts = four(0).map((o, i) => (i === 1 ? { ...o, correct: true } : o));
    const { report } = validateGenerated({
      sections: [{ competencyCode: "C1", questions: [{ type: "mcq", prompt: "Q?", options: opts }] }],
    });
    expect(report.droppedQuestions).toBe(1);
  });

  it("keeps open-ended questions", () => {
    const { assessment } = validateGenerated({
      sections: [{ competencyCode: "C1", questions: [{ type: "text", prompt: "Describe a time..." }] }],
    });
    expect(assessment.sections[0].questions[0]).toEqual({ type: "text", prompt: "Describe a time..." });
  });

  it("shuffles options so the correct answer is not always in the same place", () => {
    const positions = new Set<number>();
    for (let n = 0; n < 60; n++) {
      const { assessment } = validateGenerated({
        sections: [{ competencyCode: "C1", questions: [{ type: "mcq", prompt: "Q?", options: four(0) }] }],
      });
      positions.add(assessment.sections[0].questions[0].options!.findIndex((o) => o.correct));
    }
    expect(positions.size).toBeGreaterThan(1);
  });
});
