"use client";

import { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/ui";

export type SwipeTone = "critical" | "brand" | "accent";

const TONE_STYLES: Record<SwipeTone, { fill: string; handle: string; ring: string; text: string }> = {
  critical: { fill: "bg-red-100", handle: "bg-critical", ring: "ring-red-200", text: "text-critical" },
  brand: { fill: "bg-brand-50", handle: "bg-brand", ring: "ring-brand/20", text: "text-brand" },
  accent: { fill: "bg-accent-soft", handle: "bg-accent-dark", ring: "ring-accent/25", text: "text-accent-dark" },
};

/**
 * A drag-to-confirm slider: the user must physically slide a handle across a
 * track to trigger the action. Releasing early snaps the handle back with a
 * springy, gravity-like overshoot instead of settling instantly — replacing a
 * plain click (or a window.confirm() popup) with deliberate, tactile friction
 * for actions that are hard or impossible to undo.
 *
 * Fully keyboard/screen-reader accessible: the handle is a real slider
 * (role="slider") and Enter/Space plays an automatic slide-to-complete.
 */
export function SwipeToConfirm({
  label,
  onConfirm,
  disabled = false,
  tone = "critical",
  icon = "arrowRight",
  height = 46,
  className = "",
}: {
  label: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  tone?: SwipeTone;
  icon?: string;
  height?: number;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [maxX, setMaxX] = useState(0);
  const startXRef = useRef(0);
  const maxXRef = useRef(0);

  const t = TONE_STYLES[tone];
  const pad = 4;
  const handleSize = height - pad * 2;

  const measure = () => {
    const track = trackRef.current;
    const m = track ? Math.max(0, track.clientWidth - handleSize - pad * 2) : 0;
    maxXRef.current = m;
    setMaxX(m);
    return m;
  };

  const complete = useCallback(() => {
    if (done) return;
    setDone(true);
    setDragging(false);
    measure();
    setDragX(maxXRef.current);
    Promise.resolve(onConfirm()).catch(() => {
      window.setTimeout(() => {
        setDone(false);
        setDragX(0);
      }, 1200);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, onConfirm]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || done) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    measure();
    startXRef.current = e.clientX - dragX;
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const next = Math.min(Math.max(0, e.clientX - startXRef.current), maxXRef.current);
    setDragX(next);
    if (maxXRef.current > 0 && next >= maxXRef.current - 1) complete();
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (maxXRef.current <= 0 || dragX < maxXRef.current - 1) setDragX(0);
  };

  const playAuto = () => {
    if (disabled || done || autoPlaying) return;
    measure();
    setAutoPlaying(true);
    setDragging(false);
    requestAnimationFrame(() => setDragX(maxXRef.current));
    window.setTimeout(() => {
      setAutoPlaying(false);
      complete();
    }, 260);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || done) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
      e.preventDefault();
      playAuto();
    }
  };

  const progress = maxX > 0 ? Math.min(1, dragX / maxX) : done ? 1 : 0;
  const snapping = !dragging && !autoPlaying;

  return (
    <div
      ref={trackRef}
      className={`relative select-none rounded-full ring-1 ring-inset ${t.ring} bg-line/40 overflow-hidden ${
        disabled ? "opacity-50" : ""
      } ${className}`}
      style={{ height }}
    >
      {/* Progress fill */}
      <div
        className={`absolute inset-y-0 left-0 ${t.fill} ${snapping ? "transition-[width] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]" : ""}`}
        style={{ width: `${dragX + handleSize + pad}px` }}
        aria-hidden
      />
      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center px-3 pointer-events-none">
        <span className={`text-[13px] font-semibold truncate transition-opacity ${progress > 0.35 ? "opacity-0" : "opacity-100"} text-foreground`}>
          {done ? "Done" : label}
        </span>
      </div>
      {/* Handle */}
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label={typeof label === "string" ? label : "Slide to confirm"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={`absolute top-1 left-1 rounded-full ${t.handle} text-white grid place-items-center shadow-md cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand ${
          snapping ? "transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]" : ""
        } ${disabled ? "pointer-events-none" : ""}`}
        style={{ width: handleSize, height: handleSize, transform: `translateX(${dragX}px)` }}
      >
        <Icon name={done ? "check" : icon} className="w-4 h-4" />
      </div>
    </div>
  );
}
