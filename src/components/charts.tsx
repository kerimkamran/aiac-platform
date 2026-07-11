/* Server-rendered SVG charts — single-hue marks, hairline grid, direct labels. */

const INK = "#111318";
const MUTED = "#7e8797";
const GRID = "#e3e8ed";
const AXIS = "#c8d0da";

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
const FUNNEL_RAMP = ["#c7c1fb", "#8577f5", "#6d5ef8", "#241e6b"];

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

/* Distinct series hues for overlaid radars: navy, gold, green, violet. */
export const RADAR_SERIES_COLORS = ["#4338ca", "#b9861a", "#0f8a5f", "#8b5cf6"];

export type RadarSeries = { name: string; color: string; values: number[] };

/* Radar / spider chart of competency profiles (0–100). Single-series via
 * `items`/`color` (original API), or 1–4 overlaid series via `labels`+`series`. */
export function RadarChart({
  items,
  size = 320,
  color = "#4338ca",
  labels,
  series,
  showLegend = false,
}: {
  items?: { label: string; value: number }[];
  size?: number;
  color?: string;
  labels?: string[];
  series?: RadarSeries[];
  showLegend?: boolean;
}) {
  const axes = labels ?? items?.map((i) => i.label) ?? [];
  const allSeries: RadarSeries[] =
    series ?? (items ? [{ name: "", color, values: items.map((i) => i.value) }] : []);
  const n = axes.length;
  if (n < 3 || allSeries.length === 0) return null;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 46;
  const fillOpacity = allSeries.length > 1 ? 0.1 : 0.14;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, r: number) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  const ringPath = (f: number) =>
    axes.map((_, i) => pt(i, R * f).map((v) => v.toFixed(1)).join(",")).join(" ");
  const valueR = (v: number) => (R * Math.max(0, Math.min(100, v))) / 100;

  return (
    <div>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm mx-auto" role="img" aria-label="Competency radar profile">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={ringPath(f)} fill="none" stroke={GRID} strokeWidth={1} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, R);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={GRID} strokeWidth={1} />;
        })}
        {allSeries.map((s) => (
          <polygon
            key={s.name}
            points={s.values.map((v, i) => pt(i, valueR(v)).map((c) => c.toFixed(1)).join(",")).join(" ")}
            fill={s.color}
            fillOpacity={fillOpacity}
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}
        {allSeries.map((s) =>
          s.values.map((v, i) => {
            const [x, y] = pt(i, valueR(v));
            return (
              <circle key={`${s.name}-${i}`} cx={x} cy={y} r={allSeries.length > 1 ? 3 : 3.5} fill={s.color} stroke="#fff" strokeWidth={2}>
                <title>{s.name ? `${s.name} — ${axes[i]}: ${v}` : `${axes[i]}: ${v}`}</title>
              </circle>
            );
          })
        )}
        {axes.map((label, i) => {
          const [x, y] = pt(i, R + 22);
          const anchor = Math.abs(x - cx) < 10 ? "middle" : x > cx ? "start" : "end";
          const words = label.length > 16 ? `${label.slice(0, 15)}…` : label;
          return (
            <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={10} fontWeight={500} fill={MUTED}>
              {words}
            </text>
          );
        })}
      </svg>
      {showLegend && allSeries.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-3">
          {allSeries.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="truncate max-w-32">{s.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
