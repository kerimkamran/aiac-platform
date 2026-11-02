// A resting node field: the lattice, the V drawn through nodes, the green
// vantage point and the horizon, as a still picture. Used on the navy brand
// panel of the sign-in pages and on the 404 page ("the V drifting out of
// frame"). The animated version for the landing hero is HorizonField.
const W = 640;
const H = 440;
const HORIZON_Y = 180;
const LEFT = Array.from({ length: 8 }, (_, i) => ({ x: 200 + (120 * i) / 7, y: 60 + (240 * i) / 7 }));
const RIGHT = Array.from({ length: 7 }, (_, i) => ({ x: 440 - (120 * i) / 7, y: 60 + (240 * i) / 7 }));
const LATTICE: { x: number; y: number }[] = [];
for (let x = 20; x <= 620; x += 60) for (let y = 40; y <= 400; y += 60) LATTICE.push({ x, y });

export function NodeField({
  className = "",
  tone = "panel",
  drift = false,
}: {
  className?: string;
  // "panel" is for the navy brand panel; "page" for a normal page background.
  tone?: "panel" | "page";
  // Shifts the V up and to the right, fading, for the 404 page.
  drift?: boolean;
}) {
  const panel = tone === "panel";
  const field = panel ? "var(--on-panel)" : "var(--horizon-from)";
  const from = panel ? "var(--mark-from)" : "var(--horizon-from)";
  const to = panel ? "var(--mark-to)" : "var(--horizon-to)";
  const vantage = panel ? "var(--on-panel-green)" : "var(--horizon-to)";
  const gid = `nf-${tone}`;
  const hid = `nf-h-${tone}`;
  const pts = (a: { x: number; y: number }[]) => a.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: from }} />
          <stop offset="1" style={{ stopColor: to }} />
        </linearGradient>
        <linearGradient id={hid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: from, stopOpacity: 0 }} />
          <stop offset="0.35" style={{ stopColor: from }} />
          <stop offset="1" style={{ stopColor: to }} />
        </linearGradient>
      </defs>
      {LATTICE.map((p) => (
        <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r={2.4} style={{ fill: field }} opacity={panel ? 0.16 : 0.14} />
      ))}
      <g style={drift ? { transform: "translate(70px, -50px)" } : undefined} opacity={drift ? 0.55 : 1}>
        <polyline points={pts(LEFT)} fill="none" stroke={`url(#${gid})`} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={pts([...RIGHT, LEFT[LEFT.length - 1]])} fill="none" stroke={`url(#${gid})`} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {[...LEFT, ...RIGHT].map((p) => (
          <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r={4} style={{ fill: panel ? "var(--on-panel)" : "var(--horizon-from)" }} />
        ))}
        <circle cx={320} cy={HORIZON_Y} r={9} style={{ fill: vantage }} />
      </g>
      {!drift && <line x1={0} y1={HORIZON_Y} x2={W} y2={HORIZON_Y} stroke={`url(#${hid})`} strokeWidth={2} />}
    </svg>
  );
}
