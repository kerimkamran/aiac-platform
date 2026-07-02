/* Server-rendered SVG charts — single-hue marks, hairline grid, direct labels. */

const INK = "#101c2c";
const MUTED = "#8a97a8";
const GRID = "#e1e0d9";
const AXIS = "#c3c2b7";

/* Vertical bar chart of counts per proficiency band. */
export function BandDistribution({
  buckets,
}: {
  buckets: { label: string; count: number; hex: string }[];
}) {
  const W = 460;
  const H = 200;
  const pad = { t: 16, r: 8, b: 34, l: 8 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const slot = plotW / buckets.length;
  const barW = Math.min(48, slot * 0.5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Candidates per proficiency band">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + plotH * (1 - f)} y2={pad.t + plotH * (1 - f)} stroke={GRID} strokeWidth={1} />
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke={AXIS} strokeWidth={1} />
      {buckets.map((b, i) => {
        const h = (b.count / max) * plotH;
        const x = pad.l + slot * i + (slot - barW) / 2;
        const y = pad.t + plotH - h;
        return (
          <g key={b.label}>
            <title>{`${b.label}: ${b.count} candidate(s)`}</title>
            {b.count > 0 && (
              <rect className="anim-grow-y" x={x} y={y} width={barW} height={h} rx={4} fill={b.hex} style={{ transformBox: "fill-box" }} />
            )}
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>
              {b.count}
            </text>
            <text x={pad.l + slot * i + slot / 2} y={H - 14} textAnchor="middle" fontSize={10.5} fontWeight={500} fill={MUTED}>
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* Horizontal pipeline funnel — ordinal single-hue ramp (validated blue steps). */
const FUNNEL_RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab"];

export function PipelineFunnel({ stages }: { stages: { label: string; count: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="space-y-3">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center gap-3" title={`${s.label}: ${s.count}`}>
          <span className="w-24 text-xs font-medium text-muted shrink-0">{s.label}</span>
          <div className="flex-1 h-6 rounded-md bg-line/40 overflow-hidden">
            <div
              className="h-full rounded-md anim-grow"
              style={{ width: `${Math.max(2.5, (s.count / max) * 100)}%`, background: FUNNEL_RAMP[Math.min(i, FUNNEL_RAMP.length - 1)] }}
            />
          </div>
          <span className="w-8 text-sm font-bold text-foreground tabular-nums text-right shrink-0">{s.count}</span>
        </div>
      ))}
    </div>
  );
}

/* Radar / spider chart for one candidate's competency profile (0–100). */
export function RadarChart({
  items,
  size = 320,
  color = "#2a78d6",
}: {
  items: { label: string; value: number }[];
  size?: number;
  color?: string;
}) {
  const n = items.length;
  if (n < 3) return null;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 46;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, r: number) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  const ringPath = (f: number) =>
    items.map((_, i) => pt(i, R * f).map((v) => v.toFixed(1)).join(",")).join(" ");
  const valuePts = items.map((it, i) => pt(i, (R * Math.min(100, it.value)) / 100).map((v) => v.toFixed(1)).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm mx-auto" role="img" aria-label="Competency radar profile">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ringPath(f)} fill="none" stroke={GRID} strokeWidth={1} />
      ))}
      {items.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={GRID} strokeWidth={1} />;
      })}
      <polygon points={valuePts} fill={color} fillOpacity={0.14} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {items.map((it, i) => {
        const [x, y] = pt(i, (R * Math.min(100, it.value)) / 100);
        return (
          <circle key={i} cx={x} cy={y} r={3.5} fill={color} stroke="#fff" strokeWidth={2}>
            <title>{`${it.label}: ${it.value}`}</title>
          </circle>
        );
      })}
      {items.map((it, i) => {
        const [x, y] = pt(i, R + 22);
        const anchor = Math.abs(x - cx) < 10 ? "middle" : x > cx ? "start" : "end";
        const words = it.label.length > 16 ? `${it.label.slice(0, 15)}…` : it.label;
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={10} fontWeight={500} fill={MUTED}>
            {words}
          </text>
        );
      })}
    </svg>
  );
}
