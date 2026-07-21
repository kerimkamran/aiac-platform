import { Card, Icon } from "@/components/ui";

type GrowthAssessment = {
  id: string;
  title: string;
  submittedAt: string;
  overallScore: number;
  competencies: { name: string; score: number }[];
};

function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  const w = 240;
  const h = 56;
  const pad = 6;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const up = values[values.length - 1] >= values[0];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none">
      <path d={path} fill="none" stroke={up ? "#0f8a5f" : "#d97706"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === points.length - 1 ? 3.5 : 2.5} fill={up ? "#0f8a5f" : "#d97706"} />
      ))}
      {last && <circle cx={last[0]} cy={last[1]} r="6" fill={up ? "#0f8a5f" : "#d97706"} opacity="0.15" />}
    </svg>
  );
}

export function GrowthHub({ assessments }: { assessments: GrowthAssessment[] }) {
  const overallSeries = assessments.map((a) => Math.round(a.overallScore));
  const first = overallSeries[0];
  const last = overallSeries[overallSeries.length - 1];
  const delta = last - first;

  // Competency-level movement: compare the earliest and latest score for
  // every competency that appears in both, so growth is visible per-skill,
  // not just as one overall number.
  const byCompetency = new Map<string, number[]>();
  for (const a of assessments) {
    for (const c of a.competencies) {
      const arr = byCompetency.get(c.name) || [];
      arr.push(c.score);
      byCompetency.set(c.name, arr);
    }
  }
  const movers = Array.from(byCompetency.entries())
    .filter(([, scores]) => scores.length >= 2)
    .map(([name, scores]) => ({ name, delta: Math.round(scores[scores.length - 1] - scores[0]), latest: Math.round(scores[scores.length - 1]) }))
    .sort((a, b) => b.delta - a.delta);
  const improved = movers.filter((m) => m.delta > 0).slice(0, 3);
  const growthAreas = movers.filter((m) => m.delta <= 0).slice(-3).reverse();

  return (
    <Card className="p-6 mb-8">
      <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
        <Icon name="trending" className="w-4 h-4 text-brand" />
        Your growth over time
      </p>
      <p className="text-xs text-muted mb-5">
        Tracking your competency scores across {assessments.length} promotion/development assessments — this is about
        progress, not a single pass/fail moment.
      </p>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-6">
        <Sparkline values={overallSeries} className="w-full sm:w-60 h-14 shrink-0" />
        <div>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {last}
            <span className="text-sm font-medium text-faint"> / 100</span>
          </p>
          <p className={`text-xs font-semibold ${delta > 0 ? "text-emerald-700" : delta < 0 ? "text-amber-700" : "text-faint"}`}>
            {delta > 0 ? `+${delta}` : delta} since your first tracked assessment
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {improved.length > 0 && (
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint mb-2">Most improved</p>
            <div className="space-y-1.5">
              {improved.map((m) => (
                <div key={m.name} className="flex items-center justify-between text-[13px] bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <span className="text-foreground font-medium">{m.name}</span>
                  <span className="font-bold text-emerald-700 tabular-nums">+{m.delta}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {growthAreas.length > 0 && (
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint mb-2">Keep developing</p>
            <div className="space-y-1.5">
              {growthAreas.map((m) => (
                <div key={m.name} className="flex items-center justify-between text-[13px] bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="text-foreground font-medium">{m.name}</span>
                  <span className="font-bold text-amber-700 tabular-nums">{m.delta > 0 ? "+" : ""}{m.delta}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
