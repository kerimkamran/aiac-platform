"use client";

// A warm, tasteful "you did it" moment for candidates right after they submit
// a timed assessment — small delight, deterministic (no Math.random at render
// time so server/client markup always matches) confetti + a hand-drawn seal.

const CONFETTI_COLORS = ["var(--brand)", "var(--accent)", "var(--chart-3)", "var(--brand-light)"];
const PIECE_COUNT = 26;

function pseudoRandom(seed: number, salt: number) {
  const x = Math.sin(seed * 999 + salt * 37.13) * 10000;
  return x - Math.floor(x);
}

export function ConfettiBurst() {
  const pieces = Array.from({ length: PIECE_COUNT }, (_, i) => {
    const left = pseudoRandom(i, 1) * 100;
    const drift = (pseudoRandom(i, 2) - 0.5) * 140;
    const spin = 180 + pseudoRandom(i, 3) * 360;
    const delay = pseudoRandom(i, 4) * 0.5;
    const duration = 2 + pseudoRandom(i, 5) * 1.2;
    const size = 5 + pseudoRandom(i, 6) * 5;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const round = i % 3 === 0;
    return { left, drift, spin, delay, duration, size, color, round, key: i };
  });

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.key}
          className="confetti-piece absolute top-0"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size * (p.round ? 1 : 2.2),
              background: p.color,
              borderRadius: p.round ? "9999px" : "2px",
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ["--drift" as string]: `${p.drift}px`,
              ["--spin" as string]: `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function SubmissionSeal() {
  return (
    <div className="relative inline-flex items-center justify-center w-28 h-28 mb-2">
      <span className="anim-seal-ring absolute inset-0 rounded-full bg-accent/25" />
      <svg viewBox="0 0 100 100" className="anim-seal-pop relative w-24 h-24" role="img" aria-label="Submitted successfully">
        <circle cx="50" cy="50" r="46" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2.5" />
        <path
          d="M32 51 L44 63 L69 37"
          fill="none"
          stroke="var(--accent-dark)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="anim-seal-draw"
          style={{ ["--seal-len" as string]: 62 }}
        />
      </svg>
    </div>
  );
}
