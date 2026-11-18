// Column headers and fixed values of the candidates Excel export in English,
// Azerbaijani and Russian (Batch 29). The file follows the language of the
// person downloading it. AZ and RU need a native speaker's review (plan B12).

import type { PdfLang } from "./pdf-copy";

type ExcelCopy = {
  sheet: string;
  headers: Record<
    | "name" | "email" | "department" | "assessment" | "vacancy" | "status" | "overall" | "core" | "leadership"
    | "functional" | "tabSwitches" | "invitedAt" | "submittedAt" | "decision" | "decidedBy" | "comment",
    string
  >;
  status: Record<string, string>;
  decision: Record<string, string>;
};

export const EXCEL_COPY: Record<PdfLang, ExcelCopy> = {
  en: {
    sheet: "Candidates",
    headers: {
      name: "Full Name", email: "Email", department: "Department / Structure", assessment: "Assessment", vacancy: "Vacancy",
      status: "Status", overall: "Overall role fit", core: "Core Avg", leadership: "Leadership Avg", functional: "Functional Avg",
      tabSwitches: "Tab Switches", invitedAt: "Invited At", submittedAt: "Submitted At", decision: "Latest Decision",
      decidedBy: "Decided By", comment: "Decision Comment",
    },
    status: { invited: "Invited", in_progress: "In progress", submitted: "Submitted", scored: "Awaiting review", reviewed: "Reviewed" },
    decision: {
      shortlist: "Shortlist", hold: "Hold", reject: "Reject", recommend: "Recommend", needs_development_plan: "Needs development plan",
      not_yet_ready: "Not yet ready", strengths_identified: "Strengths identified", growth_areas_identified: "Growth areas identified",
    },
  },
  az: {
    sheet: "Namizədlər",
    headers: {
      name: "Ad, soyad", email: "E-poçt", department: "Struktur bölmə", assessment: "Qiymətləndirmə", vacancy: "Vakansiya",
      status: "Status", overall: "Rola ümumi uyğunluq", core: "Əsas (orta)", leadership: "Liderlik (orta)", functional: "Funksional (orta)",
      tabSwitches: "Səhifədən çıxma sayı", invitedAt: "Dəvət tarixi", submittedAt: "Təhvil tarixi", decision: "Son qərar",
      decidedBy: "Qərar verən", comment: "Qərara şərh",
    },
    status: { invited: "Dəvət olunub", in_progress: "Davam edir", submitted: "Təhvil verilib", scored: "Yoxlama gözləyir", reviewed: "Yoxlanılıb" },
    decision: {
      shortlist: "Qısa siyahıya", hold: "Gözləmədə", reject: "Rədd", recommend: "Tövsiyə olunur", needs_development_plan: "İnkişaf planı lazımdır",
      not_yet_ready: "Hələ hazır deyil", strengths_identified: "Güclü tərəflər müəyyən edilib", growth_areas_identified: "İnkişaf sahələri müəyyən edilib",
    },
  },
  ru: {
    sheet: "Кандидаты",
    headers: {
      name: "ФИО", email: "Эл. почта", department: "Подразделение", assessment: "Оценка", vacancy: "Вакансия",
      status: "Статус", overall: "Общее соответствие роли", core: "Базовые (ср.)", leadership: "Лидерские (ср.)", functional: "Функциональные (ср.)",
      tabSwitches: "Уходы со вкладки", invitedAt: "Дата приглашения", submittedAt: "Дата сдачи", decision: "Последнее решение",
      decidedBy: "Кто решил", comment: "Комментарий к решению",
    },
    status: { invited: "Приглашён", in_progress: "В процессе", submitted: "Сдано", scored: "Ждёт проверки", reviewed: "Проверено" },
    decision: {
      shortlist: "В шорт-лист", hold: "Отложить", reject: "Отклонить", recommend: "Рекомендовать", needs_development_plan: "Нужен план развития",
      not_yet_ready: "Пока не готов", strengths_identified: "Сильные стороны определены", growth_areas_identified: "Зоны роста определены",
    },
  },
};
