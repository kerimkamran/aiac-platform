// Fixed wording of the PDF report in English, Azerbaijani and Russian
// (Batch 29). The report follows the language of the person downloading it.
// AZ and RU need a native speaker's review before go-live (plan B12).

export type PdfLang = "en" | "az" | "ru";

export const PDF_LOCALE: Record<PdfLang, string> = { en: "en-GB", az: "az-Latn-AZ", ru: "ru-RU" };

type PdfCopy = {
  docTitle: (name: string) => string;
  confidential: string;
  assessment: string;
  vacancy: string;
  department: string;
  submitted: string;
  executiveSummary: string;
  aiSynthesis: string;
  strengths: string;
  developmentAreas: string;
  noStrengths: string;
  noDevelopmentAreas: string;
  overallFit: string;
  notScored: string;
  summaryStaff: string;
  summaryCandidate: string;
  peers: (pct: number, n: number, avg: number | null) => string;
  talentMatrix: (label: string) => string;
  integrity: (n: number) => string;
  competencyBreakdown: string;
  category: Record<string, string>;
  avg: string;
  responseDetail: string;
  noAnswer: string;
  needsReview: string;
  aiRationale: (score: number) => string;
  decisionLog: string;
  generated: (when: string) => string;
  page: (p: number, total: number) => string;
  bands: { exceeds: string; fully: string; partially: string; not: string };
  // Stored competency levels (score-attempt.ts) shown beside each score.
  levels: Record<string, string>;
};

export const PDF_COPY: Record<PdfLang, PdfCopy> = {
  en: {
    docTitle: (n) => `${n} — Assessment Report`,
    confidential: "CONFIDENTIAL\nCandidate Assessment Report",
    assessment: "Assessment",
    vacancy: "Vacancy",
    department: "Department",
    submitted: "Submitted",
    executiveSummary: "Executive Summary",
    aiSynthesis: "AI-Assisted Synthesis",
    strengths: "Strengths",
    developmentAreas: "Development areas",
    noStrengths: "No standout competencies above 60 yet.",
    noDevelopmentAreas: "No competencies below 70 — solid across the board.",
    overallFit: "Overall role fit\n(out of 100)",
    notScored: "Not yet scored",
    summaryStaff:
      "Weighted average across all mapped competencies, combining AI-assisted scoring of situational and behavioral responses. This assessment is designed to be reviewed alongside interview evidence and is not intended as a sole basis for a hiring or promotion decision.",
    summaryCandidate: "Weighted average across all mapped competencies. Each score was reviewed and confirmed by a person.",
    peers: (pct, n, avg) =>
      ` Scored higher than ${pct}% of the ${n} candidate(s) assessed for this role${avg !== null ? ` (peer average: ${avg})` : ""}.`,
    talentMatrix: (l) => ` Talent Matrix placement: ${l}.`,
    integrity: (n) => ` Integrity note: the candidate left the assessment tab ${n} time(s) during the session.`,
    competencyBreakdown: "Competency Breakdown",
    category: { Core: "CORE", Leadership: "LEADERSHIP", Functional: "FUNCTIONAL" },
    avg: "avg",
    responseDetail: "Response Detail",
    noAnswer: "(no answer provided)",
    needsReview: "NEEDS REVIEW -- low-confidence score, confirm before relying on it",
    aiRationale: (s) => `AI rationale (${s}/100): `,
    decisionLog: "Decision Log",
    generated: (w) => `Generated ${w}`,
    page: (p, t) => `Page ${p} of ${t}`,
    bands: {
      exceeds: "Exceeds Expectations",
      fully: "Fully Meets Expectations",
      partially: "Partially Meets Expectations",
      not: "Does Not Meet Expectations",
    },
    levels: { Exceeds: "Exceeds", "Fully Meets": "Fully Meets", "Partially Meets": "Partially Meets", "Does Not Meet": "Does Not Meet" },
  },
  az: {
    docTitle: (n) => `${n} — Qiymətləndirmə hesabatı`,
    confidential: "MƏXFİ\nNamizədin qiymətləndirmə hesabatı",
    assessment: "Qiymətləndirmə",
    vacancy: "Vakansiya",
    department: "Struktur bölmə",
    submitted: "Təhvil verilib",
    executiveSummary: "Qısa xülasə",
    aiSynthesis: "Süni intellektin köməyi ilə xülasə",
    strengths: "Güclü tərəflər",
    developmentAreas: "İnkişaf sahələri",
    noStrengths: "Hələ 60-dan yuxarı seçilən kompetensiya yoxdur.",
    noDevelopmentAreas: "70-dən aşağı kompetensiya yoxdur — bütün sahələrdə sabit nəticə.",
    overallFit: "Ümumi uyğunluq\n(100 baldan)",
    notScored: "Hələ qiymətləndirilməyib",
    summaryStaff:
      "Bütün kompetensiyalar üzrə çəkili orta bal; situasiya və davranış cavabları süni intellektin köməyi ilə qiymətləndirilib. Bu qiymətləndirmə müsahibə nəticələri ilə birlikdə nəzərdən keçirilməlidir və işə qəbul və ya vəzifə artımı qərarı üçün yeganə əsas deyil.",
    summaryCandidate: "Bütün kompetensiyalar üzrə çəkili orta bal. Hər bal bir şəxs tərəfindən yoxlanılıb və təsdiqlənib.",
    peers: (pct, n, avg) =>
      ` Bu rol üçün qiymətləndirilən ${n} namizədin ${pct}%-indən yüksək nəticə${avg !== null ? ` (orta nəticə: ${avg})` : ""}.`,
    talentMatrix: (l) => ` İstedad matrisində yeri: ${l}.`,
    integrity: (n) => ` Dürüstlük qeydi: namizəd sessiya ərzində qiymətləndirmə səhifəsini ${n} dəfə tərk edib.`,
    competencyBreakdown: "Kompetensiyalar üzrə nəticələr",
    category: { Core: "ƏSAS", Leadership: "LİDERLİK", Functional: "FUNKSİONAL" },
    avg: "orta",
    responseDetail: "Cavabların təfərrüatı",
    noAnswer: "(cavab verilməyib)",
    needsReview: "YOXLAMA TƏLƏB OLUNUR -- bal etibarlı deyil, istifadə etməzdən əvvəl təsdiqləyin",
    aiRationale: (s) => `Süni intellektin əsaslandırması (${s}/100): `,
    decisionLog: "Qərarlar tarixçəsi",
    generated: (w) => `Yaradılıb: ${w}`,
    page: (p, t) => `Səhifə ${p} / ${t}`,
    bands: {
      exceeds: "Gözləntiləri aşır",
      fully: "Gözləntilərə tam cavab verir",
      partially: "Gözləntilərə qismən cavab verir",
      not: "Gözləntilərə cavab vermir",
    },
    levels: { Exceeds: "Aşır", "Fully Meets": "Tam cavab verir", "Partially Meets": "Qismən cavab verir", "Does Not Meet": "Cavab vermir" },
  },
  ru: {
    docTitle: (n) => `${n} — отчёт об оценке`,
    confidential: "КОНФИДЕНЦИАЛЬНО\nОтчёт об оценке кандидата",
    assessment: "Оценка",
    vacancy: "Вакансия",
    department: "Подразделение",
    submitted: "Сдано",
    executiveSummary: "Краткое резюме",
    aiSynthesis: "Сводка, подготовленная с помощью ИИ",
    strengths: "Сильные стороны",
    developmentAreas: "Зоны развития",
    noStrengths: "Пока нет компетенций с баллом выше 60.",
    noDevelopmentAreas: "Нет компетенций ниже 70 — стабильный результат во всех областях.",
    overallFit: "Общее соответствие роли\n(из 100)",
    notScored: "Ещё не оценено",
    summaryStaff:
      "Средневзвешенный балл по всем компетенциям; ситуационные и поведенческие ответы оценены с помощью ИИ. Оценку следует рассматривать вместе с результатами интервью; она не является единственным основанием для решения о найме или повышении.",
    summaryCandidate: "Средневзвешенный балл по всем компетенциям. Каждый балл проверен и подтверждён человеком.",
    peers: (pct, n, avg) =>
      ` Результат выше, чем у ${pct}% из ${n} кандидатов, оценённых на эту роль${avg !== null ? ` (средний балл: ${avg})` : ""}.`,
    talentMatrix: (l) => ` Позиция в матрице талантов: ${l}.`,
    integrity: (n) => ` Примечание: во время сессии кандидат покидал вкладку с оценкой ${n} раз(а).`,
    competencyBreakdown: "Результаты по компетенциям",
    category: { Core: "БАЗОВЫЕ", Leadership: "ЛИДЕРСКИЕ", Functional: "ФУНКЦИОНАЛЬНЫЕ" },
    avg: "ср.",
    responseDetail: "Подробности ответов",
    noAnswer: "(ответ не дан)",
    needsReview: "ТРЕБУЕТ ПРОВЕРКИ -- низкая уверенность в балле, подтвердите перед использованием",
    aiRationale: (s) => `Обоснование ИИ (${s}/100): `,
    decisionLog: "Журнал решений",
    generated: (w) => `Создано: ${w}`,
    page: (p, t) => `Страница ${p} из ${t}`,
    bands: {
      exceeds: "Превосходит ожидания",
      fully: "Полностью соответствует ожиданиям",
      partially: "Частично соответствует ожиданиям",
      not: "Не соответствует ожиданиям",
    },
    levels: { Exceeds: "Превосходит", "Fully Meets": "Полностью соответствует", "Partially Meets": "Частично соответствует", "Does Not Meet": "Не соответствует" },
  },
};

export function pdfLang(raw: string | null | undefined): PdfLang {
  return raw === "az" || raw === "ru" ? raw : "en";
}
