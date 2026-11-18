import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { CandidateReportDocument, type ReportData } from "./pdf-report";
import { PDF_COPY } from "./pdf-copy";

const base: ReportData = {
  candidateName: "Aysel Məmmədova",
  candidateEmail: "aysel@example.com",
  assessmentTitle: "Satış meneceri",
  vacancyTitle: null,
  department: null,
  overallScore: 72,
  percentile: null,
  peerAvg: null,
  peerCount: 0,
  submittedAt: "2026-11-18T10:00:00Z",
  competencies: [{ name: "Müştəri yönümlülük", category: "Core", score: 72, level: "Skilled" }],
  responses: [{ prompt: "Nə edərdiniz?", answer: "Müştəriyə zəng edərdim.", score: 72, rationale: "" }],
  decisions: [],
  generatedAt: "2026-11-18T10:00:00Z",
  showAiRationale: false,
};

describe("PDF report wording", () => {
  it("has the same keys in every language", () => {
    expect(Object.keys(PDF_COPY.az).sort()).toEqual(Object.keys(PDF_COPY.en).sort());
    expect(Object.keys(PDF_COPY.ru).sort()).toEqual(Object.keys(PDF_COPY.en).sort());
  });

  it.each(["en", "az", "ru"] as const)("renders a candidate copy in %s", async (lang) => {
    const buf = await renderToBuffer(<CandidateReportDocument data={{ ...base, lang }} />);
    expect(buf.length).toBeGreaterThan(5000);
  }, 30_000);
});
