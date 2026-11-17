// Turns pasted text into people to invite. One person per line, in any of:
//   Aysel Mammadova, aysel@example.com
//   Aysel Mammadova <aysel@example.com>
//   aysel@example.com            (the name is guessed from the address)
// Lines that cannot be read are returned so the screen can say which ones.
export type PastedPerson = { name: string; email: string };

const EMAIL = /[^\s,;<>"']+@[^\s,;<>"']+\.[^\s,;<>"']+/;

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] || "";
  const words = local.split(/[._\-+]+/).filter((w) => /[a-zA-Z]/.test(w));
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

export function parsePeopleList(text: string): { people: PastedPerson[]; unreadable: string[] } {
  const people: PastedPerson[] = [];
  const unreadable: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(EMAIL);
    if (!match) {
      unreadable.push(line);
      continue;
    }
    const email = match[0].toLowerCase();
    const name = line
      .replace(match[0], "")
      .replace(/[<>,;"']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    people.push({ name: name || nameFromEmail(email), email });
  }
  return { people, unreadable };
}
