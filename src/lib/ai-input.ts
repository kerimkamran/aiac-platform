// Text that leaves this process for an external AI provider passes through
// redactForAi() first. It removes e-mail addresses and phone numbers in the
// formats used in this platform's market (Azerbaijan: +994 and 0XX numbers),
// and reports how many of each it removed so staff can see what happened.
//
// Personal names are deliberately NOT stripped: case studies routinely use
// fictional protagonists, and a regex cannot tell those from real people.
// Uploaders are still expected to use anonymised material.

export type RedactionReport = { emails: number; phones: number };

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

// A phone candidate is a run of digits with optional leading +, spaces,
// dashes, dots and brackets. It must contain 9-15 digits, or start with "+"
// and contain 8 or more. That keeps years, scores, section numbers and date
// ranges such as "2019-2020" (8 digits, no "+") out of the redaction.
const PHONE_CANDIDATE = /(?<![\w+])\+?\(?\d[\d\s().-]{6,}\d(?![\w])/g;

function isPhone(candidate: string): boolean {
  const digits = (candidate.match(/\d/g) || []).length;
  if (candidate.trim().startsWith("+")) return digits >= 8 && digits <= 15;
  return digits >= 9 && digits <= 15;
}

export function redactForAi(text: string): { text: string; report: RedactionReport } {
  let emails = 0;
  let phones = 0;

  let out = text.replace(EMAIL, () => {
    emails += 1;
    return "[EMAIL REDACTED]";
  });

  out = out.replace(PHONE_CANDIDATE, (m) => {
    if (!isPhone(m)) return m;
    phones += 1;
    return "[PHONE REDACTED]";
  });

  return { text: out, report: { emails, phones } };
}
