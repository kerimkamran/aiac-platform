// Deadlines are picked as a calendar date and mean "the end of that day" in the
// organisation's time zone (Asia/Baku, UTC+4, no daylight saving) -- not 23:59
// UTC, which would end the day at 03:59 local time (INV-B-25).

const ORG_TIME_ZONE = "Asia/Baku";

/** Today's calendar date in the organisation's time zone, as YYYY-MM-DD. */
export function orgToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ORG_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type DeadlineResult = { ok: true; iso: string | null } | { ok: false; error: string };

/** Turns a picked date into the stored end-of-day moment, or explains why not. */
export function deadlineFromDate(raw: string, now: Date = new Date()): DeadlineResult {
  const value = raw.trim();
  if (!value) return { ok: true, iso: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: "The deadline isn't a valid date." };
  const end = new Date(`${value}T23:59:59+04:00`);
  if (Number.isNaN(end.getTime())) return { ok: false, error: "The deadline isn't a valid date." };
  if (value < orgToday(now)) return { ok: false, error: "The deadline can't be in the past. Pick today or a later date." };
  return { ok: true, iso: end.toISOString() };
}
