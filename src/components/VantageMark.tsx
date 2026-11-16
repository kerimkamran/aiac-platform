// The Vantage mark: "two views, one clear decision" (redesign plan B7).
// Every part means something:
//  - left dot: evidence (what the candidate shows)
//  - right dot: judgment (a trained person confirms every score)
//  - links: every score is tied to its evidence
//  - green point, the largest: the vantage point, where both views meet
//  - the three points form an equilateral triangle: the same process and weight
//    for everyone; the top is open: nothing is hidden
// The dots have the dot size of the Azerconnect Group symbol (radius 7.75 on a
// 64 grid). Below 24 px use `mono`. With `tile` the mark sits on the Azerconnect
// navy field with white views and the lighter green point; without it, it uses
// the navy-to-green colours on any page. `animate` plays moment W1 once (dots
// appear, links draw, the green point lands); it is a plain visible mark if
// animation is off.
const SIDE = 36;
const A: [number, number] = [14, 17];
const B: [number, number] = [50, 17];
const C: [number, number] = [32, 17 + (SIDE * Math.sqrt(3)) / 2];
const LINK_LENGTH = Math.hypot(C[0] - A[0], C[1] - A[1]);

export function VantageMark({
  className = "w-8 h-8",
  tile = true,
  mono = false,
  animate = false,
  title,
}: {
  className?: string;
  tile?: boolean;
  mono?: boolean;
  animate?: boolean;
  title?: string;
}) {
  const gid = `vantage-mark-${tile ? "tile" : "bare"}`;
  const views = mono ? "currentColor" : tile ? "var(--mark-field)" : "var(--horizon-from)";
  const point = mono ? "currentColor" : tile ? "var(--mark-node)" : "var(--horizon-to)";
  const linkStroke = mono ? "currentColor" : `url(#${gid})`;
  const from = tile ? "var(--mark-from)" : "var(--horizon-from)";
  const to = tile ? "var(--mark-to)" : "var(--horizon-to)";
  const cls = animate ? "mark-animate" : undefined;
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {!mono && (
        <defs>
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={A[0]} y1={A[1]} x2={C[0]} y2={C[1]}>
            <stop offset="0" style={{ stopColor: from }} />
            <stop offset="1" style={{ stopColor: to }} />
          </linearGradient>
        </defs>
      )}
      {tile && !mono && <rect width="64" height="64" rx="14" style={{ fill: "var(--mark-tile)" }} />}
      <g className={cls} style={{ ["--len" as string]: LINK_LENGTH }}>
        <line className="mark-link" x1={A[0]} y1={A[1]} x2={C[0]} y2={C[1]} stroke={linkStroke} strokeWidth={5} strokeLinecap="round" strokeDasharray={animate ? LINK_LENGTH : undefined} />
        <line className="mark-link" x1={B[0]} y1={B[1]} x2={C[0]} y2={C[1]} stroke={linkStroke} strokeWidth={5} strokeLinecap="round" strokeDasharray={animate ? LINK_LENGTH : undefined} />
        <circle className="mark-view" cx={A[0]} cy={A[1]} r={7.75} style={{ fill: views }} />
        <circle className="mark-view mark-view-2" cx={B[0]} cy={B[1]} r={7.75} style={{ fill: views }} />
        <circle className="mark-point" cx={C[0]} cy={C[1]} r={9.5} style={{ fill: point, transformOrigin: `${C[0]}px ${C[1]}px` }} />
      </g>
    </svg>
  );
}
