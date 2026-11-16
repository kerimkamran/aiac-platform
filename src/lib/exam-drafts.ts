// Answers are kept in this browser while a candidate works. On a shared
// computer they must not outlive the person, so signing out removes them
// (plan CAN-B-34).
export function clearExamDrafts(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("aiac-exam-") || k.startsWith("aiac-answers-"))) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage can be blocked; nothing to clear then.
  }
}
