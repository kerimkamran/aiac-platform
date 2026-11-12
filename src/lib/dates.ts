// Small date helpers for the homes. Pure, so they are easy to test.
const DAY = 86_400_000;

// "today", "1 day", "5 days" since a moment. Never negative.
export function ageLabel(from: string | Date | null | undefined, now: Date = new Date()): string {
  if (!from) return "";
  const days = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / DAY));
  if (days === 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}

export function daysSince(from: string | Date | null | undefined, now: Date = new Date()): number {
  if (!from) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / DAY));
}

// "due today", "due in 3 days", "2 days overdue".
export function dueLabel(due: string | Date | null | undefined, now: Date = new Date()): string {
  if (!due) return "";
  const days = Math.ceil((new Date(due).getTime() - now.getTime()) / DAY);
  if (days < 0) return days === -1 ? "1 day overdue" : `${-days} days overdue`;
  if (days === 0) return "due today";
  return days === 1 ? "due tomorrow" : `due in ${days} days`;
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// How long a scored candidate may wait for a person before the staff home flags
// it. Default agreed in the design plan (owner item: confirm with HR).
export const REVIEW_TARGET_DAYS = 3;
