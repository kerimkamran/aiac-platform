import { Document, Page, View, Text, StyleSheet, Svg, Path, Rect } from "@react-pdf/renderer";

const BRAND = "#0D3D8C";
const BRAND_DEEP = "#0A2553";
const ACCENT = "#2D6B16";
const INK = "#111318";
const MUTED = "#5D6674";
const LINE = "#E3E8ED";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: INK, fontFamily: "Helvetica" },
  headerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: `2 solid ${BRAND}`, paddingBottom: 14 },
  brandBlock: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BRAND_DEEP },
  brandSub: { fontSize: 7, color: ACCENT, letterSpacing: 1, marginTop: 2 },
  confidential: { fontSize: 8, color: MUTED, textAlign: "right" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 2 },
  subtitle: { fontSize: 10, color: MUTED, marginBottom: 16 },
  metaRow: { flexDirection: "row", gap: 24, marginBottom: 20 },
  metaLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: INK, marginTop: 18, marginBottom: 10, borderBottom: `1 solid ${LINE}`, paddingBottom: 6 },
  scoreCard: { flexDirection: "row", gap: 16, marginBottom: 8 },
  scoreBig: { width: 110, alignItems: "center", justifyContent: "center", border: `1 solid ${LINE}`, borderRadius: 8, padding: 14 },
  scoreBigNum: { fontSize: 30, fontFamily: "Helvetica-Bold", color: BRAND },
  scoreBigLabel: { fontSize: 8, color: MUTED, marginTop: 2, textAlign: "center" },
  scoreSummary: { flex: 1, border: `1 solid ${LINE}`, borderRadius: 8, padding: 14, justifyContent: "center" },
  competencyRow: { marginBottom: 10 },
  competencyLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  competencyName: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  competencyScore: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  barTrack: { height: 6, backgroundColor: LINE, borderRadius: 3 },
  questionBlock: { marginBottom: 10, padding: 10, border: `1 solid ${LINE}`, borderRadius: 6 },
  questionPrompt: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  questionAnswer: { fontSize: 8.5, color: MUTED, marginBottom: 4, lineHeight: 1.4 },
  rationale: { fontSize: 8, color: ACCENT, fontFamily: "Helvetica-Oblique" },
  decisionRow: { flexDirection: "row", gap: 8, marginBottom: 6, alignItems: "flex-start" },
  decisionBadge: { fontSize: 7.5, fontFamily: "Helvetica-Bold", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, color: "#fff" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, borderTop: `1 solid ${LINE}`, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: MUTED },
  execCard: { border: `1 solid ${LINE}`, borderRadius: 8, padding: 14, marginBottom: 14 },
  execHeadlineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  execRecBadge: { fontSize: 7.5, fontFamily: "Helvetica-Bold", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, color: "#fff" },
  execHeadline: { fontSize: 9, color: INK, lineHeight: 1.5, marginBottom: 8 },
  execCols: { flexDirection: "row", gap: 16, marginBottom: 6 },
  execColTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  execLine: { fontSize: 8, color: MUTED, marginBottom: 2 },
  execComparison: { fontSize: 7.5, color: MUTED, borderTop: `1 solid ${LINE}`, paddingTop: 6, marginTop: 4 },
});

function bandInfo(score: number) {
  if (score >= 85) return { label: "Exceeds Expectations", color: "#1c400f" };
  if (score >= 70) return { label: "Fully Meets Expectations", color: ACCENT };
  if (score >= 50) return { label: "Partially Meets Expectations", color: "#b9861a" };
  return { label: "Does Not Meet Expectations", color: "#d03b3b" };
}

function recColor(label: string) {
  if (label === "Strong fit") return "#0e9f6e";
  if (label === "Fit with reservations") return ACCENT;
  if (label === "Borderline") return "#d97706";
  return "#dc2626";
}

function decisionColor(d: string) {
  if (d === "shortlist") return "#0e9f6e";
  if (d === "hold") return "#d97706";
  if (d === "reject") return "#dc2626";
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
    strengths: string[];
    developmentAreas: string[];
    comparisonSentence: string | null;
  } | null;
  submittedAt: string | null;
  tabSwitchCount?: number;
  competencies: { name: string; category: string; score: number; level: string }[];
  responses: { prompt: string; answer: string; score: number; rationale: string }[];
  decisions: { decision: string; comment: string; reviewer: string; createdAt: string }[];
  generatedAt: string;
};

function LogoMark() {
  return (
    <Svg width={26} height={26} viewBox="0 0 64 64">
      <Rect width={64} height={64} rx={14} fill={BRAND_DEEP} />
      <Path d="M32 12 L48 48 H40.5 L32 27 L23.5 48 H16 Z" fill="#ffffff" />
      <Path d="M27 42a5 5 0 1 0 10 0 5 5 0 0 0-10 0z" fill={ACCENT} />
    </Svg>
  );
}

export function CandidateReportDocument({ data }: { data: ReportData }) {
  const band = data.overallScore !== null ? bandInfo(data.overallScore) : null;
  const byCategory = ["Core", "Leadership", "Functional"]
    .map((cat) => ({ cat, rows: data.competencies.filter((c) => c.category === cat) }))
    .filter((g) => g.rows.length > 0);

  return (
    <Document title={`${data.candidateName} — Assessment Report`} author="AI Assessment Center by Azerconnect Group">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <View style={styles.brandBlock}>
            <LogoMark />
            <View>
              <Text style={styles.brandTitle}>AI Assessment Center</Text>
              <Text style={styles.brandSub}>BY AZERCONNECT GROUP</Text>
            </View>
          </View>
          <Text style={styles.confidential}>CONFIDENTIAL{"\n"}Candidate Assessment Report</Text>
        </View>

        <Text style={styles.h1}>{data.candidateName}</Text>
        <Text style={styles.subtitle}>{data.candidateEmail}</Text>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>Assessment</Text>
            <Text style={styles.metaValue}>{data.assessmentTitle}</Text>
          </View>
          {data.vacancyTitle && (
            <View>
              <Text style={styles.metaLabel}>Vacancy</Text>
              <Text style={styles.metaValue}>{data.vacancyTitle}</Text>
            </View>
          )}
          {data.department && (
            <View>
              <Text style={styles.metaLabel}>Department</Text>
              <Text style={styles.metaValue}>{data.department}</Text>
            </View>
          )}
          <View>
            <Text style={styles.metaLabel}>Submitted</Text>
            <Text style={styles.metaValue}>{data.submittedAt ? new Date(data.submittedAt).toLocaleDateString() : "—"}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Executive Summary</Text>

        {data.executiveSummary && (
          <View style={styles.execCard} wrap={false}>
            <View style={styles.execHeadlineRow}>
              <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: INK }}>AI-Assisted Synthesis</Text>
              <Text style={{ ...styles.execRecBadge, backgroundColor: recColor(data.executiveSummary.recommendationLabel) }}>
                {data.executiveSummary.recommendationLabel.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.execHeadline}>{data.executiveSummary.headline}</Text>
            <View style={styles.execCols}>
              <View style={{ flex: 1 }}>
                <Text style={styles.execColTitle}>Strengths</Text>
                {data.executiveSummary.strengths.length > 0 ? (
                  data.executiveSummary.strengths.map((s, i) => (
                    <Text key={i} style={styles.execLine}>• {s}</Text>
                  ))
                ) : (
                  <Text style={styles.execLine}>No standout competencies above 60 yet.</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.execColTitle}>Development areas</Text>
                {data.executiveSummary.developmentAreas.length > 0 ? (
                  data.executiveSummary.developmentAreas.map((s, i) => (
                    <Text key={i} style={styles.execLine}>• {s}</Text>
                  ))
                ) : (
                  <Text style={styles.execLine}>No competencies below 70 — solid across the board.</Text>
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
            <Text style={styles.scoreBigLabel}>Overall Role Fit{"\n"}(out of 100)</Text>
          </View>
          <View style={styles.scoreSummary}>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: band?.color || MUTED, marginBottom: 4 }}>
              {band?.label || "Not yet scored"}
            </Text>
            <Text style={{ fontSize: 8.5, color: MUTED, lineHeight: 1.5 }}>
              Weighted average across all mapped competencies, combining AI-assisted scoring of situational and
              behavioral responses. This assessment is designed to be reviewed alongside interview evidence and
              is not intended as a sole basis for a hiring or promotion decision.
              {data.percentile !== null && data.percentile !== undefined
                ? ` Scored higher than ${data.percentile}% of the ${data.peerCount} candidate(s) assessed for this role${
                    data.peerAvg !== null && data.peerAvg !== undefined ? ` (peer average: ${data.peerAvg})` : ""
                  }.`
                : ""}
              {data.boxLabel ? ` Talent Matrix placement: ${data.boxLabel}.` : ""}
              {data.tabSwitchCount ? ` Integrity note: the candidate left the assessment tab ${data.tabSwitchCount} time(s) during the session.` : ""}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Competency Breakdown</Text>
        {byCategory.map((group) => (
          <View key={group.cat} wrap={false}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6, marginTop: 6 }}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: BRAND }}>{group.cat.toUpperCase()}</Text>
              <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: MUTED }}>
                avg {Math.round(group.rows.reduce((a, c) => a + c.score, 0) / group.rows.length)}
              </Text>
            </View>
            {group.rows.map((c, i) => (
              <View key={i} style={styles.competencyRow}>
                <View style={styles.competencyLabelRow}>
                  <Text style={styles.competencyName}>{c.name}</Text>
                  <Text style={styles.competencyScore}>
                    {Math.round(c.score)} · {c.level}
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
          Response Detail
        </Text>
        {data.responses.map((r, i) => (
          <View key={i} style={styles.questionBlock} wrap={false}>
            <Text style={styles.questionPrompt}>
              {i + 1}. {r.prompt}
            </Text>
            <Text style={styles.questionAnswer}>{r.answer || "(no answer provided)"}</Text>
            <Text style={styles.rationale}>
              AI rationale ({Math.round(r.score)}/100): {r.rationale}
            </Text>
          </View>
        ))}

        {data.decisions.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Decision Log</Text>
            {data.decisions.map((d, i) => (
              <View key={i} style={styles.decisionRow}>
                <Text style={{ ...styles.decisionBadge, backgroundColor: decisionColor(d.decision) }}>
                  {d.decision.toUpperCase()}
                </Text>
                <Text style={{ fontSize: 8.5, color: MUTED, flex: 1 }}>
                  <Text style={{ fontFamily: "Helvetica-Bold", color: INK }}>{d.reviewer}</Text>
                  {d.comment ? ` — "${d.comment}"` : ""} · {new Date(d.createdAt).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {new Date(data.generatedAt).toLocaleString()} · AI Assessment Center by Azerconnect Group</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
