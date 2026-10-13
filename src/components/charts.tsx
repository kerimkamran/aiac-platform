/* Server-rendered SVG charts — single-hue marks, hairline grid, direct labels. */

// Design-execution-plan Phase 3 / T3.1: these four used to be hardcoded
// hexes that never consulted the theme. In dark mode the "ink" text sat on
// the dark card surface at ~1.04:1 -- functionally invisible (#111318 on
// #171717). SVG presentation attributes accept CSS custom properties in
// every browser this app targets, so these reference the same tokens the
// rest of the app already uses for text (--foreground/--muted, verified
// 4.5:1+ by contrast.test.ts) plus the two chart-specific line tokens that
// existed in globals.css but were never wired into anything until now.
const MUTED = "var(--muted)";
const GRID = "var(--chart-grid)";

/* Vertical bar chart of counts per proficiency band. */
export const RADAR_SERIES_COLORS = ["var(--foreground)", "var(--accent)", "var(--chart-4)", "var(--line-strong)"];

export type RadarSeries = { name: string; color: string; values: number[] };

// Design-execution-plan Phase 3 / T3.3: overlaid series used to be told
// apart by color alone, with a color-dot legend -- green and gold are hard
// to tell apart under deuteranopia. Each series index now also gets its
// own dash pattern (outline) and marker shape (points), so a comparison
// survives even if color can't be perceived at all.
const SERIES_DASH = ["", "6,3", "1.5,3", "6,2,1.5,2"];
const SERIES_SHAPE: ("circle" | "square" | "diamond" | "triangle")[] = ["circle", "square", "diamond", "triangle"];

function SeriesMarker({
  shape,
  cx,
  cy,
  r,
  fill,
}: {
  shape: (typeof SERIES_SHAPE)[number];
  cx: number;
  cy: number;
  r: number;
  fill: string;
}) {
  // A ring the same color as the card surface separates the marker from
  // the polygon fill/gridlines behind it -- var(--surface) rather than a
  // hardcoded white, so it matches the card in dark mode too instead of
  // punching a bright halo into it.
  const common = { fill, stroke: "var(--surface)", strokeWidth: 2 };
  if (shape === "square") {
    const s = r * 1.7;
    return <rect x={cx - s / 2} y={cy - s / 2} width={s} height={s} {...common} />;
  }
  if (shape === "diamond") {
    const s = r * 1.3;
    return <rect x={cx - s} y={cy - s} width={s * 2} height={s * 2} transform={`rotate(45 ${cx} ${cy})`} {...common} />;
  }
  if (shape === "triangle") {
    const s = r * 1.6;
    const points = [
      [cx, cy - s],
      [cx - s * 0.95, cy + s * 0.7],
      [cx + s * 0.95, cy + s * 0.7],
    ]
      .map((p) => p.join(","))
      .join(" ");
    return <polygon points={points} {...common} />;
  }
  return <circle cx={cx} cy={cy} r={r} {...common} />;
}

/* Radar / spider chart of competency profiles (0–100). Single-series via
 * `items`/`color` (original API), or 1–4 overlaid series via `labels`+`series`. */
export function RadarChart({
  items,
  size = 320,
  color = "var(--accent)",
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

  // Design-execution-plan Phase 3 / T3.4: "Competency radar profile" named
  // the chart type, not a finding, and the per-point <title> tooltips
  // aren't reliably announced outside mouse hover -- Level A. The label
  // states the actual strongest/weakest axis (or, for a comparison, which
  // candidate leads), and the visually-hidden table makes every axis/score
  // pair for every series reachable by ordinary screen-reader table
  // navigation.
  const avg = (vals: number[]) => vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
  let finding: string;
  if (allSeries.length === 1) {
    const s = allSeries[0];
    let hi = 0;
    let lo = 0;
    s.values.forEach((v, i) => {
      if (v > s.values[hi]) hi = i;
      if (v < s.values[lo]) lo = i;
    });
    finding = `Competency profile: strongest in ${axes[hi]} at ${s.values[hi]}, weakest in ${axes[lo]} at ${s.values[lo]}`;
  } else {
    const best = allSeries.reduce((b, s) => (avg(s.values) > avg(b.values) ? s : b), allSeries[0]);
    finding = `Competency comparison across ${allSeries.length} candidates: ${best.name || "the leading candidate"} has the highest average score`;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm mx-auto" role="img" aria-label={finding}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={ringPath(f)} fill="none" stroke={GRID} strokeWidth={1} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, R);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={GRID} strokeWidth={1} />;
        })}
        {allSeries.map((s, si) => (
          <polygon
            key={s.name}
            points={s.values.map((v, i) => pt(i, valueR(v)).map((c) => c.toFixed(1)).join(",")).join(" ")}
            fill={s.color}
            fillOpacity={fillOpacity}
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeDasharray={allSeries.length > 1 ? SERIES_DASH[si % SERIES_DASH.length] : undefined}
          />
        ))}
        {allSeries.map((s, si) =>
          s.values.map((v, i) => {
            const [x, y] = pt(i, valueR(v));
            const shape = allSeries.length > 1 ? SERIES_SHAPE[si % SERIES_SHAPE.length] : "circle";
            return (
              <g key={`${s.name}-${i}`}>
                <SeriesMarker shape={shape} cx={x} cy={y} r={allSeries.length > 1 ? 3.5 : 3.5} fill={s.color} />
                <title>{s.name ? `${s.name} — ${axes[i]}: ${v}` : `${axes[i]}: ${v}`}</title>
              </g>
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
      <table className="sr-only">
        <caption>{finding}</caption>
        <thead>
          <tr>
            <th scope="col">Competency</th>
            {allSeries.map((s, si) => (
              <th key={s.name || si} scope="col">
                {s.name || "Score"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {axes.map((axis, i) => (
            <tr key={axis}>
              <th scope="row">{axis}</th>
              {allSeries.map((s, si) => (
                <td key={s.name || si}>{s.values[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {showLegend && allSeries.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-3">
          {allSeries.map((s, si) => {
            const shape = SERIES_SHAPE[si % SERIES_SHAPE.length];
            const dash = SERIES_DASH[si % SERIES_DASH.length];
            return (
              <span key={s.name} className="flex items-center gap-1.5 text-xs font-medium text-muted">
                {/* Design-execution-plan Phase 3 / T3.3: the swatch itself
                    now draws the series' line (dash pattern) and marker
                    (shape), not just its color, so the legend carries the
                    same non-color cues as the chart it explains. */}
                <svg width="18" height="10" viewBox="0 0 18 10" className="shrink-0" aria-hidden>
                  <line x1={0} y1={5} x2={18} y2={5} stroke={s.color} strokeWidth={2} strokeDasharray={dash || undefined} />
                  <SeriesMarker shape={shape} cx={9} cy={5} r={3} fill={s.color} />
                </svg>
                <span className="truncate max-w-32">{s.name}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
