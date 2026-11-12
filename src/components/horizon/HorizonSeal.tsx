// Expressive moment 3, the Horizon seal (Clear Horizon plan, section 8): shown
// once, after a candidate submits. A ring appears, the V draws itself, the
// horizon grows through it and the green vantage point lands. Calm, no
// confetti, and under reduced motion the finished seal simply appears.
export function HorizonSeal({ className = "w-28 h-28" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={`anim-seal-pop ${className}`} role="img" aria-label="Your answers are in">
      <defs>
        <linearGradient id="seal-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="horizon-stop-from" />
          <stop offset="1" className="horizon-stop-to" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="55" fill="var(--accent-soft)" stroke="url(#seal-g)" strokeWidth="2" />
      <polyline
        points="34,36 60,76 86,36"
        fill="none"
        stroke="url(#seal-g)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="anim-draw"
        style={{ ["--len" as string]: 100, ["--draw-delay" as string]: "0.25s" }}
      />
      <rect
        x="18"
        y="51"
        width="84"
        height="2"
        rx="1"
        fill="url(#seal-g)"
        className="anim-grow-x"
        style={{ transformBox: "fill-box", ["--draw-delay" as string]: "0.7s" }}
      />
      <circle cx="60" cy="52" r="6" fill="var(--horizon-to)" className="anim-seal-pop" style={{ transformOrigin: "60px 52px", animationDelay: "1.0s" }} />
    </svg>
  );
}
