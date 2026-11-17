import { describe, expect, it } from "vitest";
import { shapeGenerated, validateGenerated } from "./generation";

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

describe("shapeGenerated", () => {
  const q = (n: number) => Array.from({ length: n }, (_, i) => ({ type: "text" as const, prompt: `Question number ${i}` }));

  it("drops unknown codes, matches case-insensitively and merges repeats", () => {
    const { assessment, report } = shapeGenerated(
      { sections: [{ competencyCode: "c1", questions: q(2) }, { competencyCode: "ZZ", questions: q(3) }, { competencyCode: "C1", questions: q(1) }] },
      { droppedQuestions: 0, droppedReasons: [] },
      ["C1", "C2"],
      20
    );
    expect(assessment.sections).toHaveLength(1);
    expect(assessment.sections[0].competencyCode).toBe("C1");
    expect(assessment.sections[0].questions).toHaveLength(3);
    expect(report.droppedQuestions).toBe(3);
    expect(report.droppedReasons[0]).toMatch(/unknown competency/);
  });

  it("trims to the chosen length from the longest section first", () => {
    const { assessment, report } = shapeGenerated(
      { sections: [{ competencyCode: "A", questions: q(6) }, { competencyCode: "B", questions: q(4) }] },
      { droppedQuestions: 0, droppedReasons: [] },
      ["A", "B"],
      7
    );
    const total = assessment.sections.reduce((n, s) => n + s.questions.length, 0);
    expect(total).toBe(7);
    expect(assessment.sections.map((s) => s.questions.length)).toEqual([3, 4]);
    expect(report.trimmedQuestions).toBe(3);
    expect(report.droppedQuestions).toBe(0);
  });
});

describe("section titles", () => {
  const q = [{ type: "text", prompt: "Describe a time you led a team through change." }];

  it("keeps a translated section title and drops an absurdly long one", () => {
    const { assessment } = validateGenerated({
      sections: [
        { competencyCode: "C1", sectionTitle: "  Komanda rəhbərliyi ", questions: q },
        { competencyCode: "C2", sectionTitle: "x".repeat(200), questions: q },
      ],
    });
    expect(assessment.sections[0].sectionTitle).toBe("Komanda rəhbərliyi");
    expect(assessment.sections[1].sectionTitle).toBeUndefined();
  });

  it("carries the title through shaping", () => {
    const { assessment } = shapeGenerated(
      { sections: [{ competencyCode: "c1", sectionTitle: "Лидерство", questions: [{ type: "text", prompt: "Q number one" }] }] },
      { droppedQuestions: 0, droppedReasons: [] },
      ["C1"],
      10
    );
    expect(assessment.sections[0].sectionTitle).toBe("Лидерство");
  });
});
