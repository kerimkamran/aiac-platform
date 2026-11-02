"use client";

import { useEffect, useRef } from "react";

// Expressive moment 1, "horizon resolve" (Clear Horizon plan, section 8): a
// faint lattice of navy nodes appears; about 15 of them glide into the two
// arms of the V; the links draw navy to green; the green vantage point lands
// with one soft pulse; then the horizon draws outward through the V. 2.4s,
// plays once, pure SVG and CSS (about 2 kB, no libraries).
//
// - The headline is plain HTML and paints first; this figure never blocks it.
// - It pauses while off screen (IntersectionObserver sets data-paused).
// - Optional pointer parallax: a 6px shift on desktop pointers only.
// - Reduced motion: the global rule ends every animation at once, so the
//   final frame shows, static.
// - On small screens half the lattice is hidden.
const W = 640;
const H = 440;
const HORIZON_Y = 180;
const LEFT = Array.from({ length: 8 }, (_, i) => ({ x: 200 + (120 * i) / 7, y: 60 + (240 * i) / 7 }));
const RIGHT = Array.from({ length: 7 }, (_, i) => ({ x: 440 - (120 * i) / 7, y: 60 + (240 * i) / 7 }));
const ARM_NODES = [...LEFT, ...RIGHT];
const LATTICE: { x: number; y: number; extra: boolean }[] = [];
for (let x = 20, c = 0; x <= 620; x += 60, c++) for (let y = 40, r = 0; y <= 400; y += 60, r++) LATTICE.push({ x, y, extra: (c + r) % 2 === 1 });

// Deterministic start offsets so server and client render the same markup.
const offset = (i: number) => ({ dx: ((i * 37) % 11) * 14 - 70, dy: ((i * 53) % 9) * 16 - 64 });

function len(a: { x: number; y: number }[]) {
  let total = 0;
  for (let i = 1; i < a.length; i++) total += Math.hypot(a[i].x - a[i - 1].x, a[i].y - a[i - 1].y);
  return Math.ceil(total);
}
const LEFT_LEN = len(LEFT);
const RIGHT_LEN = len([...RIGHT, LEFT[LEFT.length - 1]]);

export function HorizonField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<SVGGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      el.dataset.paused = entry.isIntersecting ? "false" : "true";
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Pointer parallax: desktop pointers only, never under reduced motion.
  useEffect(() => {
    const el = ref.current;
    const g = inner.current;
    if (!el || !g) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || calm) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 12;
      const y = ((e.clientY - r.top) / r.height - 0.5) * 12;
      g.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const pts = (a: { x: number; y: number }[]) => a.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <div ref={ref} data-paused="false" className={className}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" role="img" aria-label="Scattered points drawing together into the Vantage V, with a horizon line through it.">
        <defs>
          <linearGradient id="hf-arm" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="horizon-stop-from" />
            <stop offset="1" className="horizon-stop-to" />
          </linearGradient>
          <linearGradient id="hf-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" className="horizon-stop-from" style={{ stopOpacity: 0 }} />
            <stop offset="0.3" className="horizon-stop-from" />
            <stop offset="1" className="horizon-stop-to" />
          </linearGradient>
        </defs>
        <g ref={inner} style={{ transition: "transform 160ms var(--ease-standard)" }}>
          <g className="hf-lattice">
            {LATTICE.map((p) => (
              <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r={2.4} className={p.extra ? "hidden sm:inline" : ""} style={{ fill: "var(--horizon-from)" }} opacity={0.16} />
            ))}
          </g>
          <polyline
            className="hf-link"
            points={pts(LEFT)}
            fill="none"
            stroke="url(#hf-arm)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ ["--len" as string]: LEFT_LEN }}
          />
          <polyline
            className="hf-link"
            points={pts([...RIGHT, LEFT[LEFT.length - 1]])}
            fill="none"
            stroke="url(#hf-arm)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ ["--len" as string]: RIGHT_LEN }}
          />
          {ARM_NODES.map((p, i) => {
            const o = offset(i);
            return (
              <circle
                key={`${p.x}-${p.y}`}
                className="hf-node-drift"
                cx={p.x}
                cy={p.y}
                r={4.5}
                style={{ fill: "var(--horizon-from)", ["--hf-dx" as string]: `${o.dx}px`, ["--hf-dy" as string]: `${o.dy}px`, ["--hf-delay" as string]: `${(i % 7) * 0.08}s` }}
              />
            );
          })}
          <circle className="hf-pulse" cx={320} cy={HORIZON_Y} r={9} style={{ fill: "var(--horizon-to)" }} />
          <circle className="hf-vantage" cx={320} cy={HORIZON_Y} r={9} style={{ fill: "var(--horizon-to)" }} />
        </g>
        <line className="hf-horizon" x1={-200} y1={HORIZON_Y} x2={W + 400} y2={HORIZON_Y} stroke="url(#hf-line)" strokeWidth={2} />
      </svg>
    </div>
  );
}
