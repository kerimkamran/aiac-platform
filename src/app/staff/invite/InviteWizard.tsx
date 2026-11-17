"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, ProgressBar } from "@/components/ui";
import { Button, buttonClass } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { FieldLabel, Input, Textarea } from "@/components/ui/Field";
import { CopyInviteLinkButton } from "@/components/CopyInviteLinkButton";
import { parsePeopleList } from "@/lib/invite-paste";
import { sendInvitations, MAX_PEOPLE_PER_INVITE, type InviteResult, type PersonResult } from "./actions";

export type InviteTest = { id: string; title: string; minutes: number; level: string | null; language: string | null };

type Person = { name: string; email: string };

const STEPS = ["Who are you inviting?", "Which test?", "Check and send"] as const;
const LANG_LABEL: Record<string, string> = { en: "English", az: "Azərbaycan dili", ru: "Русский" };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function InviteWizard({ tests, preselected, canCopyLink }: { tests: InviteTest[]; preselected: string; canCopyLink: boolean }) {
  const [step, setStep] = useState(0);
  const [people, setPeople] = useState<Person[]>([{ name: "", email: "" }]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [testId, setTestId] = useState(preselected || (tests.length === 1 ? tests[0].id : ""));
  const [due, setDue] = useState(defaultDeadline);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<InviteResult, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  const test = tests.find((t) => t.id === testId) ?? null;
  const filled = people.filter((p) => p.name.trim() || p.email.trim());

  function setPerson(i: number, patch: Partial<Person>) {
    setPeople((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addPasted() {
    const { people: found, unreadable } = parsePeopleList(pasteText);
    if (found.length === 0) {
      setError("We couldn't find any email addresses in that text. Put one person per line, for example: Aysel Mammadova, aysel@example.com");
      return;
    }
    setPeople((rows) => [...rows.filter((r) => r.name.trim() || r.email.trim()), ...found]);
    setPasteText("");
    setPasteOpen(false);
    setError(unreadable.length > 0 ? `Added ${found.length}. We skipped ${unreadable.length} line${unreadable.length === 1 ? "" : "s"} with no email address: ${unreadable.slice(0, 3).join("; ")}` : null);
  }

  function stepError(from: number): string | null {
    if (from === 0) {
      if (filled.length === 0) return "Add at least one person.";
      if (filled.length > MAX_PEOPLE_PER_INVITE) return `Invite at most ${MAX_PEOPLE_PER_INVITE} people at a time.`;
      const seen = new Set<string>();
      for (const p of filled) {
        const email = p.email.trim().toLowerCase();
        if (!p.name.trim()) return `Add a name for ${email || "everyone in the list"}.`;
        if (!EMAIL_RE.test(email)) return `${p.name.trim()}: that email address doesn't look right.`;
        if (seen.has(email)) return `${email} is in the list twice.`;
        seen.add(email);
      }
    }
    if (from === 1) {
      if (!test) return "Choose a test.";
      if (due && due < today()) return "The deadline can't be in the past.";
    }
    return null;
  }

  function next() {
    const err = stepError(step);
    if (err) return setError(err);
    setError(null);
    setStep((s) => Math.min(2, s + 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function send() {
    if (!test) return;
    setError(null);
    startTransition(async () => {
      let res: InviteResult;
      try {
        res = await sendInvitations({ people: filled, assessmentId: test.id, dueDate: due || undefined });
      } catch {
        res = { ok: false, error: "The connection dropped before we got an answer. Nothing is lost. Check Candidates before sending again." };
      }
      if (res.ok) setResult(res);
      else setError(res.error);
    });
  }

  function reset() {
    setResult(null);
    setPeople([{ name: "", email: "" }]);
    setStep(0);
    setError(null);
  }

  if (result) return <Done result={result} canCopyLink={canCopyLink} onAgain={reset} />;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <p className="text-sm font-semibold text-foreground">{STEPS[step]}</p>
          <p className="text-xs font-semibold text-muted" aria-live="polite">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>
        <ProgressBar value={((step + 1) / STEPS.length) * 100} barClass="bg-brand" />
      </div>

      {error && (
        <Callout tone="critical" role="alert">
          {error}
        </Callout>
      )}

      {step === 0 && (
        <Card className="p-6 space-y-5">
          <div className="space-y-4">
            {people.map((p, i) => (
              <div key={i} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <div>
                  <FieldLabel htmlFor={`inv-name-${i}`}>{i === 0 ? "Full name" : `Full name (${i + 1})`}</FieldLabel>
                  <Input id={`inv-name-${i}`} value={p.name} onChange={(e) => setPerson(i, { name: e.target.value })} autoComplete="off" />
                </div>
                <div>
                  <FieldLabel htmlFor={`inv-email-${i}`}>Email address</FieldLabel>
                  <Input id={`inv-email-${i}`} type="email" value={p.email} onChange={(e) => setPerson(i, { email: e.target.value })} autoComplete="off" />
                </div>
                {people.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPeople((rows) => rows.filter((_, idx) => idx !== i))}
                    className={buttonClass({ variant: "ghost", size: "md" })}
                    aria-label={`Remove person ${i + 1}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setPeople((rows) => [...rows, { name: "", email: "" }])}
              disabled={people.length >= MAX_PEOPLE_PER_INVITE}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              + Add another person
            </button>
            <button type="button" onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen} className={buttonClass({ variant: "ghost", size: "sm" })}>
              Paste a list
            </button>
          </div>
          {pasteOpen && (
            <div className="space-y-3 border-t border-line pt-4">
              <FieldLabel htmlFor="inv-paste" hint="One person per line">
                Paste names and emails
              </FieldLabel>
              <Textarea id="inv-paste" rows={5} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"Aysel Mammadova, aysel@example.com\nleyla.aliyeva@example.com"} />
              <p className="text-xs text-muted">If a line has only an email address, we use the part before the @ as the name. You can fix it afterwards.</p>
              <Button type="button" size="sm" variant="secondary" onClick={addPasted}>
                Add these people
              </Button>
            </div>
          )}
          <p className="text-xs text-muted">If someone already has an account, we add the test to it instead of creating a second one.</p>
        </Card>
      )}

      {step === 1 && (
        <Card className="p-6 space-y-5">
          {tests.length === 0 ? (
            <Callout tone="warning" title="No published tests yet">
              Publish a test first, then come back to invite people.{" "}
              <Link href="/staff/builder" className="font-semibold underline">
                Open Tests
              </Link>
            </Callout>
          ) : (
            <fieldset className="space-y-3">
              <legend className="sr-only">Choose a test</legend>
              <div className="grid sm:grid-cols-2 gap-3">
                {tests.map((t) => {
                  const on = t.id === testId;
                  return (
                    <label
                      key={t.id}
                      className={`cursor-pointer rounded-card border p-4 block transition-colors ${on ? "border-brand bg-accent-soft ring-1 ring-brand" : "border-line bg-surface hover:border-accent"}`}
                    >
                      <input type="radio" name="test" value={t.id} checked={on} onChange={() => setTestId(t.id)} className="sr-only" />
                      <span className="block font-semibold text-foreground">{t.title}</span>
                      <span className="block text-xs text-muted mt-1">
                        {[t.level, `${t.minutes} min`, t.language ? LANG_LABEL[t.language] ?? t.language : null].filter(Boolean).join(" · ")}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          <div className="max-w-xs">
            <FieldLabel htmlFor="inv-due" hint="They can't start after this date">
              Deadline
            </FieldLabel>
            <Input id="inv-due" type="date" min={today()} value={due} onChange={(e) => setDue(e.target.value)} />
            <button type="button" onClick={() => setDue("")} className="mt-1.5 text-xs font-semibold text-accent-dark hover:underline">
              No deadline
            </button>
          </div>
        </Card>
      )}

      {step === 2 && test && (
        <Card className="p-6 space-y-5">
          <dl className="grid sm:grid-cols-[8rem_1fr] gap-x-4 gap-y-2.5 text-sm">
            <dt className="text-muted">Test</dt>
            <dd className="font-semibold text-foreground">{test.title}</dd>
            <dt className="text-muted">Deadline</dt>
            <dd className="text-foreground">{due ? new Date(`${due}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "None"}</dd>
            <dt className="text-muted">People</dt>
            <dd className="text-foreground">
              <ul className="space-y-0.5">
                {filled.map((p) => (
                  <li key={p.email}>
                    {p.name.trim()} <span className="text-muted">· {p.email.trim().toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </dl>
          <div className="rounded-card bg-surface-sunken p-4 text-sm text-foreground space-y-1.5">
            <p className="font-semibold">What happens when you press Send</p>
            <p className="text-muted">
              Each new person gets an email with one button that lets them choose a password and start. The link works for a limited time. People who already have an account get the test added and an in-app notice instead of a second account.
            </p>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {step > 0 && (
            <button type="button" onClick={back} disabled={pending} className={buttonClass({ variant: "ghost", size: "md" })}>
              Back
            </button>
          )}
        </div>
        {step < 2 ? (
          <Button type="button" onClick={next} disabled={step === 1 && tests.length === 0}>
            Next
          </Button>
        ) : (
          <Button type="button" onClick={send} pending={pending} pendingLabel="Sending…">
            Send invitation{filled.length === 1 ? "" : "s"}
          </Button>
        )}
      </div>
    </div>
  );
}

const OUTCOME_LABEL: Record<PersonResult["outcome"], { text: string; tone: "good" | "info" | "warning" | "critical" }> = {
  invited: { text: "Email sent", tone: "good" },
  added: { text: "Test added", tone: "good" },
  already: { text: "Already had it", tone: "info" },
  email_failed: { text: "Email not sent", tone: "critical" },
  failed: { text: "Not done", tone: "critical" },
};

function Done({ result, canCopyLink, onAgain }: { result: Extract<InviteResult, { ok: true }>; canCopyLink: boolean; onAgain: () => void }) {
  const failed = result.results.filter((r) => r.outcome === "failed" || r.outcome === "email_failed");
  const okCount = result.results.length - failed.length;
  return (
    <div className="space-y-6">
      {failed.length === 0 ? (
        <Callout tone="good" title={okCount === 1 ? "Invitation sent" : `${okCount} invitations sent`} role="status">
          {result.testTitle}
        </Callout>
      ) : (
        <Callout tone="warning" title={`${okCount} of ${result.results.length} done, ${failed.length} need attention`} role="status">
          {result.testTitle}
        </Callout>
      )}

      <Card className="p-0 overflow-hidden">
        <ul className="divide-y divide-line">
          {result.results.map((r) => {
            const label = OUTCOME_LABEL[r.outcome];
            return (
              <li key={r.email} className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground text-sm">
                    {r.name} <span className="font-normal text-muted">· {r.email}</span>
                  </p>
                  <p className={`text-sm mt-0.5 ${label.tone === "critical" ? "text-critical" : "text-muted"}`}>
                    <span className="font-semibold">{label.text}.</span> {r.message}
                  </p>
                </div>
                {r.outcome === "email_failed" && canCopyLink && <CopyInviteLinkButton email={r.email} />}
              </li>
            );
          })}
        </ul>
      </Card>

      {failed.some((r) => r.outcome === "email_failed") && !canCopyLink && (
        <p className="text-sm text-muted">The account exists, so nothing needs to be created again. Ask an HR admin to send or copy their link from People.</p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={onAgain}>
          Invite another
        </Button>
        <Link href="/staff/reports/candidates" className={buttonClass({ variant: "secondary", size: "md" })}>
          See candidates
        </Link>
      </div>
    </div>
  );
}
