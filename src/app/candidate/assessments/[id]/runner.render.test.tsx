import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { AssessmentRunner } from "./runner";
import { en } from "@/i18n/en";
import { az } from "@/i18n/az";
import { ru } from "@/i18n/ru";
import type { Lang } from "@/i18n";

// A first-paint smoke test of the exam screen in every language: it must render
// without throwing and show the screen's own words in the chosen language.
const sections = [
  {
    id: "s1",
    title: "Section",
    questions: [
      { id: "q1", type: "mcq", prompt: "Prompt?", options: [{ key: "A", text: "One" }, { key: "B", text: "Two" }] },
      { id: "q2", type: "text", prompt: "Describe it", options: [] },
    ],
  },
];

describe("exam screen", () => {
  const cases: [Lang, typeof en.candidate.exam, string][] = [
    ["en", en.candidate.exam, "Save & exit"],
    ["az", az.candidate.exam, "Yadda saxla və çıx"],
    ["ru", ru.candidate.exam, "Сохранить и выйти"],
  ];
  for (const [lang, text, saveExit] of cases) {
    it(`renders in ${lang}`, () => {
      const html = renderToString(
        <AssessmentRunner
          caId="11111111-2222-3333-4444-555555555555"
          title="Test"
          description=""
          deadlineMs={Date.now() + 600_000}
          totalQuestions={2}
          sections={sections}
          submitAction={async () => undefined}
          lang={lang}
          text={text}
        />
      );
      expect(html).toContain(saveExit.replace("&", "&amp;"));
      expect(html).toContain(text.allQuestions);
      expect(html).toContain(text.next);
    });
  }
});
