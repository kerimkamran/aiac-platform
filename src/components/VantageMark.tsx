// The Vantage mark, "Node V" (plan v2, section 4.4): a V drawn through nodes
// of a 3x3 grid, with the centre node in green as the vantage point and the
// other nodes faint, "the field you see". Built from the node geometry of the
// Azerconnect Group logo without copying it. Colours come from the Node Grid
// tokens, so the mark follows the theme.
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
  className = "w-9 h-9",
  tile = false,
}: {
  className?: string;
  // Dark tile behind the mark, for places where the mark has no background
  // (a favicon, an app icon).
  tile?: boolean;
}) {
  const gid = "vantage-mark-gradient";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--brand)" }} />
          <stop offset="1" style={{ stopColor: "var(--secondary)" }} />
        </linearGradient>
      </defs>
      {tile && <rect width="64" height="64" rx="14" style={{ fill: "var(--brand-deep)" }} />}
      {NODES.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.6} style={{ fill: tile ? "var(--on-primary)" : "var(--brand)" }} opacity={0.22} />
      ))}
      <polyline
        points={V.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={32} cy={32} r={5.2} style={{ fill: "var(--secondary)" }} />
    </svg>
  );
}
