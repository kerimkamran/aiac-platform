// The Vantage mark, "Node V" (Clear Horizon plan, section 5.5): a V drawn
// through nodes of a 3x3 grid, with the centre node in green as the vantage
// point and the other nodes faint, "the field you see". The tile is always the
// dark night-navy, so the mark reads the same in light and dark. Without the
// tile the V takes the horizon gradient and works on any page background.
//
// The mark is the single source for the app, favicon, PDF, Excel and email
// logos. src/app/icon.svg carries the same geometry as a static file for
// browsers that need one.
const NODES: [number, number][] = [
  [16, 16], [32, 16], [48, 16],
  [16, 32], [32, 32], [48, 32],
  [16, 48], [32, 48], [48, 48],
];
const V: [number, number][] = [[16, 16], [32, 48], [48, 16]];

export function VantageMark({
  className = "w-8 h-8",
  tile = true,
  title,
}: {
  className?: string;
  // Dark tile behind the mark. On by default; turn off to place the bare V on
  // a page or a panel.
  tile?: boolean;
  title?: string;
}) {
  const gid = tile ? "vantage-mark-tile" : "vantage-mark-bare";
  const from = tile ? "var(--mark-from)" : "var(--horizon-from)";
  const to = tile ? "var(--mark-to)" : "var(--horizon-to)";
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: from }} />
          <stop offset="1" style={{ stopColor: to }} />
        </linearGradient>
      </defs>
      {tile && <rect width="64" height="64" rx="14" style={{ fill: "var(--mark-tile)" }} />}
      {NODES.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.6} style={{ fill: tile ? "var(--mark-field)" : "var(--horizon-from)" }} opacity={tile ? 0.22 : 0.25} />
      ))}
      <polyline
        points={V.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={32} cy={32} r={5.2} style={{ fill: tile ? "var(--mark-node)" : "var(--horizon-to)" }} />
    </svg>
  );
}
