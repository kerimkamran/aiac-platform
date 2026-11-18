// Where a candidate is on the way from invitation to result. Only steps the
// system can really know are shown: an email being "opened" is not tracked, so
// it is not claimed.
export const TRAIL_STEPS = ["Invited", "Signed in", "Started", "Submitted", "Reviewed"] as const;

export type TrailStep = { label: (typeof TRAIL_STEPS)[number]; done: boolean };

const STARTED = ["in_progress", "submitted", "scored", "reviewed"];
const SUBMITTED = ["submitted", "scored", "reviewed"];

export function candidateTrail(input: { status: string; lastLoginAt?: string | null }): {
  steps: TrailStep[];
  current: string;
  // Index of the last finished step, so a translated page can word `current` itself.
  currentIndex: number;
  neverSignedIn: boolean;
} {
  const started = STARTED.includes(input.status);
  const signedIn = !!input.lastLoginAt || started;
  const done = [true, signedIn, started, SUBMITTED.includes(input.status), input.status === "reviewed"];
  const steps = TRAIL_STEPS.map((label, i) => ({ label, done: done[i] }));
  const lastDone = done.lastIndexOf(true);
  const current = lastDone === 0 ? "Invited, not signed in yet" : lastDone === 1 ? "Signed in, not started" : TRAIL_STEPS[lastDone];
  return { steps, current, currentIndex: lastDone, neverSignedIn: !signedIn };
}
