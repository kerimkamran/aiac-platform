import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai-engine")>();
  return { ...actual, callEngine: vi.fn() };
});

import { callEngine } from "@/lib/ai-engine";
import { regenerateQuestion, translateAssessmentText } from "@/lib/generation";

const mocked = vi.mocked(callEngine);

const competency = { code: "CUST", name: "Customer focus", category: "Core", description: null, indicators: [] };
const options = {
  language: "az" as const,
  level: "manager" as const,
  purpose: "hiring" as const,
  questionTotal: 10,
  mix: "balanced" as const,
  context: [],
};

beforeEach(() => mocked.mockReset());

describe("translateAssessmentText", () => {
  const sections = [{ id: "s1", title: "Customer focus" }];
  const items = [{ id: "q1", prompt: "Describe a time you recovered a client.", options: ["A text", "B text", "C text", "D text"] }];

  it("maps translated text back to the same ids", async () => {
    mocked.mockResolvedValue({
      text: JSON.stringify({
        sections: [{ id: "s1", title: "Müştəri yönümlülüyü" }],
        questions: [{ id: "q1", prompt: "Müştərini necə bərpa etdiyinizi təsvir edin.", options: ["A", "B", "C", "D"] }],
      }),
      usage: {},
    } as never);
    const out = await translateAssessmentText("claude", "key", "az", sections, items);
    expect(out.sections.s1).toBe("Müştəri yönümlülüyü");
    expect(out.questions.q1.options).toHaveLength(4);
  });

  it("rejects a translation that changes the number of options", async () => {
    mocked.mockResolvedValue({
      text: JSON.stringify({
        sections: [{ id: "s1", title: "X" }],
        questions: [{ id: "q1", prompt: "Prompt text here", options: ["A", "B", "C"] }],
      }),
      usage: {},
    } as never);
    await expect(translateAssessmentText("claude", "key", "az", sections, items)).rejects.toThrow(/changed the options/);
  });

  it("rejects a translation that leaves out a section title", async () => {
    mocked.mockResolvedValue({
      text: JSON.stringify({ sections: [], questions: [{ id: "q1", prompt: "Prompt text here", options: ["A", "B", "C", "D"] }] }),
      usage: {},
    } as never);
    await expect(translateAssessmentText("claude", "key", "az", sections, items)).rejects.toThrow(/section title/);
  });
});

describe("regenerateQuestion", () => {
  it("returns one valid replacement question with a single correct answer", async () => {
    mocked.mockResolvedValue({
      text: JSON.stringify({
        sections: [
          {
            competencyCode: "CUST",
            questions: [
              {
                type: "mcq",
                prompt: "A regional client threatens to leave after a billing error. What do you do first?",
                options: [
                  { text: "Call the client today", correct: true },
                  { text: "Wait for finance", correct: false },
                  { text: "Offer a discount", correct: false },
                  { text: "Escalate to the CEO", correct: false },
                ],
              },
            ],
          },
        ],
      }),
      usage: {},
    } as never);
    const out = await regenerateQuestion("claude", "key", competency, options, {
      type: "mcq",
      previousPrompt: "Old premise",
      note: "make it harder",
    });
    expect(out.question.type).toBe("mcq");
    expect(out.question.options?.filter((o) => o.correct)).toHaveLength(1);
  });

  it("refuses a reply with the wrong question type", async () => {
    mocked.mockResolvedValue({
      text: JSON.stringify({ sections: [{ competencyCode: "CUST", questions: [{ type: "text", prompt: "Describe a time you led a recovery." }] }] }),
      usage: {},
    } as never);
    await expect(
      regenerateQuestion("claude", "key", competency, options, { type: "mcq", previousPrompt: "Old premise", note: "" })
    ).rejects.toThrow(/right shape/);
  });
});
