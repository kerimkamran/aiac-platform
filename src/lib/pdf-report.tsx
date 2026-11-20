import { Document, Page, View, Text, StyleSheet, Svg, Path, Rect, Circle, Font } from "@react-pdf/renderer";
import { BRAND as PALETTE } from "@/lib/brand";
import { PDF_FONT_INTER_400, PDF_FONT_INTER_700 } from "@/lib/pdf-fonts";
import { PDF_COPY, PDF_LOCALE, type PdfLang } from "@/lib/pdf-copy";

// Registered once at load. Inter covers body text and headings, with Azerbaijani (ə ğ ı ş İ Ə) and Cyrillic glyphs; the built-in Helvetica
// fonts cannot draw those characters.
Font.register({
  family: "Inter",
  fonts: [
    { src: PDF_FONT_INTER_400, fontWeight: 400 },
    { src: PDF_FONT_INTER_700, fontWeight: 700 },
  ],
});

// Clear Horizon palette for the PDF (design plan, section 5). The primary is
// navy and the secondary is green.
const BRAND = PALETTE.navy;
const BRAND_DEEP = PALETTE.navyDeep;
const ACCENT = PALETTE.green;
const INK = PALETTE.ink;
const MUTED = PALETTE.muted;
const LINE = PALETTE.line;
const GOOD = PALETTE.green;
const WARN = PALETTE.warning;
const CRIT = PALETTE.critical;

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: INK, fontFamily: "Inter" },
  headerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: `2 solid ${BRAND}`, paddingBottom: 14 },
  brandBlock: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandTitle: { fontSize: 13, fontFamily: "Inter", fontWeight: 700, color: BRAND_DEEP },
  brandSub: { fontSize: 7, color: ACCENT, letterSpacing: 1, marginTop: 2 },
  confidential: { fontSize: 8, color: MUTED, textAlign: "right" },
  h1: { fontSize: 18, fontFamily: "Inter", fontWeight: 700, color: INK, marginBottom: 2 },
  subtitle: { fontSize: 10, color: MUTED, marginBottom: 16 },
  metaRow: { flexDirection: "row", gap: 24, marginBottom: 20 },
  metaLabel: { fontSize: 7, color: MUTED, marginBottom: 2 },
  metaValue: { fontSize: 10, fontFamily: "Inter", fontWeight: 700 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter", fontWeight: 700, color: INK, marginTop: 18, marginBottom: 10, borderBottom: `1 solid ${LINE}`, paddingBottom: 6 },
  scoreCard: { flexDirection: "row", gap: 16, marginBottom: 8 },
  scoreBig: { width: 110, alignItems: "center", justifyContent: "center", border: `1 solid ${LINE}`, borderRadius: 8, padding: 14 },
  scoreBigNum: { fontSize: 30, fontFamily: "Inter", fontWeight: 700, color: BRAND },
  scoreBigLabel: { fontSize: 8, color: MUTED, marginTop: 2, textAlign: "center" },
  scoreSummary: { flex: 1, border: `1 solid ${LINE}`, borderRadius: 8, padding: 14, justifyContent: "center" },
  competencyRow: { marginBottom: 10 },
  competencyLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  competencyName: { fontSize: 9, fontFamily: "Inter", fontWeight: 700 },
  competencyScore: { fontSize: 9, fontFamily: "Inter", fontWeight: 700 },
  barTrack: { height: 6, backgroundColor: LINE, borderRadius: 3 },
  questionBlock: { marginBottom: 10, padding: 10, border: `1 solid ${LINE}`, borderRadius: 6 },
  questionPrompt: { fontSize: 9, fontFamily: "Inter", fontWeight: 700, marginBottom: 4 },
  questionAnswer: { fontSize: 8.5, color: MUTED, marginBottom: 4, lineHeight: 1.4 },
  rationale: { fontSize: 8, color: ACCENT, fontFamily: "Inter" },
  needsReviewBadge: { fontSize: 7, fontFamily: "Inter", fontWeight: 700, color: WARN, backgroundColor: PALETTE.warningTint, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, marginBottom: 4, alignSelf: "flex-start" },
  decisionRow: { flexDirection: "row", gap: 8, marginBottom: 6, alignItems: "flex-start" },
  decisionBadge: { fontSize: 7.5, fontFamily: "Inter", fontWeight: 700, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, color: PALETTE.white },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, borderTop: `1 solid ${LINE}`, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: MUTED },
  execCard: { border: `1 solid ${LINE}`, borderRadius: 8, padding: 14, marginBottom: 14 },
  execHeadlineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  execRecBadge: { fontSize: 7.5, fontFamily: "Inter", fontWeight: 700, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, color: PALETTE.white },
  execHeadline: { fontSize: 9, color: INK, lineHeight: 1.5, marginBottom: 8 },
  execCols: { flexDirection: "row", gap: 16, marginBottom: 6 },
  execColTitle: { fontSize: 7, fontFamily: "Inter", fontWeight: 700, color: MUTED, marginBottom: 4 },
  execLine: { fontSize: 8, color: MUTED, marginBottom: 2 },
  execComparison: { fontSize: 7.5, color: MUTED, borderTop: `1 solid ${LINE}`, paddingTop: 6, marginTop: 4 },
});

function bandInfo(score: number, lang: PdfLang = "en") {
  const b = PDF_COPY[lang].bands;
  if (score >= 85) return { label: b.exceeds, color: GOOD };
  if (score >= 70) return { label: b.fully, color: ACCENT };
  if (score >= 50) return { label: b.partially, color: WARN };
  return { label: b.not, color: CRIT };
}

function recColor(label: string) {
  if (label === "Strong fit") return GOOD;
  if (label === "Fit with reservations") return ACCENT;
  if (label === "Borderline") return WARN;
  return CRIT;
}

function decisionColor(d: string) {
  if (d === "shortlist" || d === "recommend" || d === "strengths_identified") return GOOD;
  if (d === "hold" || d === "needs_development_plan" || d === "growth_areas_identified") return WARN;
  if (d === "reject" || d === "not_yet_ready") return CRIT;
  return MUTED;
}

export type ReportData = {
  candidateName: string;
  candidateEmail: string;
  assessmentTitle: string;
  vacancyTitle?: string | null;
  department?: string | null;
  overallScore: number | null;
  percentile?: number | null;
  peerAvg?: number | null;
  peerCount?: number;
  boxLabel?: string | null;
  executiveSummary?: {
    headline: string;
    recommendationLabel: string;
    recommendationText?: string;
    strengths: string[];
    developmentAreas: string[];
    comparisonSentence: string | null;
  } | null;
  submittedAt: string | null;
  tabSwitchCount?: number;
  competencies: { name: string; category: string; score: number; level: string }[];
  responses: { prompt: string; answer: string; score: number; rationale: string; needsReview?: boolean }[];
  // Candidates get their own copy without the AI rationale and review flags (plan v2, section 9).
  showAiRationale?: boolean;
  decisions: { decision: string; comment: string; reviewer: string; createdAt: string }[];
  generatedAt: string;
  // Language of the fixed wording; the downloader's own language (Batch 29).
  lang?: PdfLang;
};

// The Vantage mark (redesign plan B7), drawn for the PDF: two views, links and
// the green vantage point on the Azerconnect navy field.
function LogoMark() {
  return (
    <Svg width={26} height={26} viewBox="0 0 64 64">
      <Rect width={64} height={64} rx={14} fill={PALETTE.markTile} />
      <Path d="M14 17 L32 48.18" stroke={PALETTE.markFrom} strokeWidth={5} strokeLinecap="round" />
      <Path d="M50 17 L32 48.18" stroke={PALETTE.markFrom} strokeWidth={5} strokeLinecap="round" />
      <Circle cx={14} cy={17} r={7.75} fill={PALETTE.white} />
      <Circle cx={50} cy={17} r={7.75} fill={PALETTE.white} />
      <Circle cx={32} cy={48.18} r={9.5} fill={PALETTE.markNode} />
    </Svg>
  );
}

export function CandidateReportDocument({ data }: { data: ReportData }) {
  const showRationale = data.showAiRationale !== false;
  const lang: PdfLang = data.lang ?? "en";
  const c = PDF_COPY[lang];
  const cp = c; // inside the competency rows, `c` is the row
  const locale = PDF_LOCALE[lang];
  const band = data.overallScore !== null ? bandInfo(data.overallScore, lang) : null;
  const byCategory = ["Core", "Leadership", "Functional"]
    .map((cat) => ({ cat, rows: data.competencies.filter((c) => c.category === cat) }))
    .filter((g) => g.rows.length > 0);

  return (
    // The document language is the language of the report's fixed wording
    // (Batch 29: the downloader's own EN/AZ/RU). @react-pdf only supports a
    // document-level language, so a question or answer written in another
    // language still sits inside it verbatim.
    <Document title={c.docTitle(data.candidateName)} author="Vantage by Azerconnect Group" language={lang}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <View style={styles.brandBlock}>
            <LogoMark />
            <View>
              <Text style={styles.brandTitle}>Vantage</Text>
              <Text style={styles.brandSub}>BY AZERCONNECT GROUP</Text>
            </View>
          </View>
          <Text style={styles.confidential}>{c.confidential}</Text>
        </View>

        <Text style={styles.h1}>{data.candidateName}</Text>
        <Text style={styles.subtitle}>{data.candidateEmail}</Text>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>{c.assessment}</Text>
            <Text style={styles.metaValue}>{data.assessmentTitle}</Text>
          </View>
          {data.vacancyTitle && (
            <View>
              <Text style={styles.metaLabel}>{c.vacancy}</Text>
              <Text style={styles.metaValue}>{data.vacancyTitle}</Text>
            </View>
          )}
          {data.department && (
            <View>
              <Text style={styles.metaLabel}>{c.department}</Text>
              <Text style={styles.metaValue}>{data.department}</Text>
            </View>
          )}
          <View>
            <Text style={styles.metaLabel}>{c.submitted}</Text>
            <Text style={styles.metaValue}>{data.submittedAt ? new Date(data.submittedAt).toLocaleDateString(locale) : "—"}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{c.executiveSummary}</Text>

        {data.executiveSummary && (
          <View style={styles.execCard} wrap={false}>
            <View style={styles.execHeadlineRow}>
              <Text style={{ fontSize: 8.5, fontFamily: "Inter", fontWeight: 700, color: INK }}>{c.aiSynthesis}</Text>
              <Text style={{ ...styles.execRecBadge, backgroundColor: recColor(data.executiveSummary.recommendationLabel) }}>
                {(data.executiveSummary.recommendationText ?? data.executiveSummary.recommendationLabel).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.execHeadline}>{data.executiveSummary.headline}</Text>
            <View style={styles.execCols}>
              <View style={{ flex: 1 }}>
                <Text style={styles.execColTitle}>{c.strengths}</Text>
                {data.executiveSummary.strengths.length > 0 ? (
                  data.executiveSummary.strengths.map((s, i) => (
                    <Text key={i} style={styles.execLine}>• {s}</Text>
                  ))
                ) : (
                  <Text style={styles.execLine}>{c.noStrengths}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.execColTitle}>{c.developmentAreas}</Text>
                {data.executiveSummary.developmentAreas.length > 0 ? (
                  data.executiveSummary.developmentAreas.map((s, i) => (
                    <Text key={i} style={styles.execLine}>• {s}</Text>
                  ))
                ) : (
                  <Text style={styles.execLine}>{c.noDevelopmentAreas}</Text>
                )}
              </View>
            </View>
            {data.executiveSummary.comparisonSentence && (
              <Text style={styles.execComparison}>{data.executiveSummary.comparisonSentence}</Text>
            )}
          </View>
        )}

        <View style={styles.scoreCard}>
          <View style={styles.scoreBig}>
            <Text style={styles.scoreBigNum}>{data.overallScore !== null ? Math.round(data.overallScore) : "—"}</Text>
            <Text style={styles.scoreBigLabel}>{c.overallFit}</Text>
          </View>
          <View style={styles.scoreSummary}>
            <Text style={{ fontSize: 10, fontFamily: "Inter", fontWeight: 700, color: band?.color || MUTED, marginBottom: 4 }}>
              {band?.label || c.notScored}
            </Text>
            <Text style={{ fontSize: 8.5, color: MUTED, lineHeight: 1.5 }}>
              {showRationale ? c.summaryStaff : c.summaryCandidate}
              {data.percentile !== null && data.percentile !== undefined ? c.peers(data.percentile, data.peerCount ?? 0, data.peerAvg ?? null) : ""}
              {data.boxLabel ? c.talentMatrix(data.boxLabel) : ""}
              {data.tabSwitchCount ? c.integrity(data.tabSwitchCount) : ""}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{c.competencyBreakdown}</Text>
        {byCategory.map((group) => (
          <View key={group.cat} wrap={false}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6, marginTop: 6 }}>
              <Text style={{ fontSize: 9, fontFamily: "Inter", fontWeight: 700, color: BRAND }}>{c.category[group.cat] ?? group.cat.toUpperCase()}</Text>
              <Text style={{ fontSize: 8, fontFamily: "Inter", fontWeight: 700, color: MUTED }}>
                {c.avg} {Math.round(group.rows.reduce((a, c) => a + c.score, 0) / group.rows.length)}
              </Text>
            </View>
            {group.rows.map((c, i) => (
              <View key={i} style={styles.competencyRow}>
                <View style={styles.competencyLabelRow}>
                  <Text style={styles.competencyName}>{c.name}</Text>
                  <Text style={styles.competencyScore}>
                    {Math.round(c.score)} · {cp.levels[c.level] ?? c.level}
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={{ height: 6, width: `${Math.min(100, Math.max(0, c.score))}%`, backgroundColor: BRAND, borderRadius: 3 }} />
                </View>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.sectionTitle} break>
          {c.responseDetail}
        </Text>
        {data.responses.map((r, i) => (
          <View key={i} style={styles.questionBlock} wrap={false}>
            <Text style={styles.questionPrompt}>
              {i + 1}. {r.prompt}
            </Text>
            <Text style={styles.questionAnswer}>{r.answer || c.noAnswer}</Text>
            {showRationale && r.needsReview && <Text style={styles.needsReviewBadge}>{c.needsReview}</Text>}
            {showRationale && (
              <Text style={styles.rationale}>
                {c.aiRationale(Math.round(r.score))}
                {r.rationale}
              </Text>
            )}
          </View>
        ))}

        {data.decisions.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>{c.decisionLog}</Text>
            {data.decisions.map((d, i) => (
              <View key={i} style={styles.decisionRow}>
                <Text style={{ ...styles.decisionBadge, backgroundColor: decisionColor(d.decision) }}>
                  {d.decision.toUpperCase()}
                </Text>
                <Text style={{ fontSize: 8.5, color: MUTED, flex: 1 }}>
                  <Text style={{ fontFamily: "Inter", fontWeight: 700, color: INK }}>{d.reviewer}</Text>
                  {d.comment ? ` — "${d.comment}"` : ""} · {new Date(d.createdAt).toLocaleDateString(locale)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{c.generated(new Date(data.generatedAt).toLocaleString(locale))} · Vantage by Azerconnect Group</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => c.page(pageNumber, totalPages)} />
        </View>
      </Page>
    </Document>
  );
}
