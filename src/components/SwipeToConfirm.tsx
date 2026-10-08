"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui";

export type SwipeTone = "critical" | "brand" | "accent";

const TONE_STYLES: Record<SwipeTone, { fill: string; handle: string; ring: string; text: string }> = {
  critical: { fill: "bg-red-100", handle: "bg-critical", ring: "ring-red-200", text: "text-critical" },
  brand: { fill: "bg-brand-50", handle: "bg-brand", ring: "ring-brand/20", text: "text-accent-dark" },
  accent: { fill: "bg-accent-soft", handle: "bg-accent-dark", ring: "ring-accent/25", text: "text-accent-dark" },
};

/**
 * A drag-to-confirm control: sliding a handle across a track triggers the
 * action, with the same deliberate, tactile friction as a physical slide
 * switch — replacing a plain click (or a window.confirm() popup) for actions
 * that are hard or impossible to undo.
 *
 * Design-execution-plan Phase 4 / T4.1 (WCAG 2.5.7 Dragging Movements): a
 * drag-only gesture fails 2.5.7 even when it's also keyboard-operable, because
 * it still traps anyone who can point/tap but can't perform a drag (limited
 * fine motor control, some switch/eye-tracking input devices, etc.). So a tap
 * is a first-class alternative here, not just a fallback: the first tap arms
 * the control (visually and via aria-pressed) and the second tap confirms —
 * mirroring the two-step "hold to arm" pattern of real hardware guards so a
 * single accidental tap still can't fire a destructive action. Dragging the
 * whole way still works exactly as before for anyone who prefers it.
 *
 * Fully keyboard/screen-reader accessible: exposed as role="button" (an
 * accurate AT mapping now that a value-less press is the primary path) with
 * aria-pressed reflecting the armed state and aria-describedby explaining all
 * three ways to activate it; Enter/Space/ArrowRight plays an automatic
 * slide-to-complete in one step, and the "Done" label swap sits in a
 * role="status" live region so completion is announced without extra props.
 */
export function SwipeToConfirm({
  label,
  ariaLabel,
  onConfirm,
  disabled = false,
  tone = "critical",
  icon = "arrowRight",
  height = 46,
  className = "",
}: {
  label: React.ReactNode;
  // `label` is often JSX (an icon + short phrase) for the visible track text,
  // which leaves no string to read as the accessible name. Pass ariaLabel
  // whenever label isn't a plain string so the control's name says what it
  // actually does ("Delete this case") instead of falling back to "Confirm".
  ariaLabel?: string;
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
  const [armed, setArmed] = useState(false);
  const startXRef = useRef(0);
  const maxXRef = useRef(0);
  const movedRef = useRef(false);
  const hintId = useId();

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
    setArmed(false);
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

  // Arming resets itself after a few seconds so a stray earlier tap can't
  // combine with an unrelated later one to fire the action.
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || done) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    measure();
    startXRef.current = e.clientX - dragX;
    movedRef.current = false;
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const next = Math.min(Math.max(0, e.clientX - startXRef.current), maxXRef.current);
    if (Math.abs(next - dragX) > 6) movedRef.current = true;
    setDragX(next);
    if (maxXRef.current > 0 && next >= maxXRef.current - 1) complete();
  };

  const onPointerUp = () => {
    if (!dragging || done) return;
    setDragging(false);
    if (maxXRef.current > 0 && dragX >= maxXRef.current - 1) return; // completed mid-drag already
    if (!movedRef.current) {
      // A tap, not a drag: arm on the first tap, confirm on the second. This
      // is the non-dragging pointer path WCAG 2.5.7 requires.
      if (armed) complete();
      else setArmed(true);
      setDragX(0);
      return;
    }
    setDragX(0);
    setArmed(false);
  };

  const playAuto = () => {
    if (disabled || done || autoPlaying) return;
    measure();
    setAutoPlaying(true);
    setDragging(false);
    setArmed(false);
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
  const labelText = ariaLabel ?? (typeof label === "string" ? label : "Confirm");

  return (
    <div
      ref={trackRef}
      className={`relative select-none rounded-full ring-1 ring-inset ${t.ring} bg-line/40 overflow-hidden ${
        disabled ? "opacity-50" : ""
      } ${armed ? "ring-2" : ""} ${className}`}
      style={{ height }}
    >
      {/* Progress fill */}
      <div
        className={`absolute inset-y-0 left-0 ${t.fill} ${snapping ? "transition-[width] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]" : ""}`}
        style={{ width: `${dragX + handleSize + pad}px` }}
        aria-hidden
      />
      {/* Label -- the "Done" swap sits in a live region so completion is
          announced to screen readers without any extra props. */}
      <div className="absolute inset-0 flex items-center justify-center px-3 pointer-events-none">
        <span
          role="status"
          className={`text-xs font-semibold truncate transition-opacity ${progress > 0.35 ? "opacity-0" : "opacity-100"} ${
            armed && !done ? t.text : "text-foreground"
          }`}
        >
          {done ? "Done" : armed ? "Tap again to confirm" : label}
        </span>
      </div>
      {/* Gesture hint for assistive tech: explains the drag, tap-twice, and
          keyboard paths since only the drag one is visually obvious. */}
      <span id={hintId} className="sr-only">
        Drag to the end, press Enter to confirm immediately, or tap once to arm and tap again to confirm.
      </span>
      {/* Handle */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-pressed={armed}
        aria-label={done ? `${labelText}: done` : labelText}
        aria-describedby={hintId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={`absolute top-1 left-1 rounded-full ${t.handle} text-white grid place-items-center shadow-md cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand ${
          snapping ? "transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]" : ""
        } ${disabled ? "pointer-events-none" : ""} ${armed ? "animate-pulse" : ""}`}
        style={{ width: handleSize, height: handleSize, transform: `translateX(${dragX}px)` }}
      >
        <Icon name={done ? "check" : icon} className="w-4 h-4" />
      </div>
    </div>
  );
}
