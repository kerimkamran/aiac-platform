import type { Dict } from "@/i18n/dictionaries";
import { Icon } from "@/components/ui/Icon";

// Fig. 02 on the landing page: one answer, the phrases the AI draft relied on,
// and the reviewer's confirmation (Clear Horizon plan, section 9). The stamp
// is the only green on the card, so "a person confirmed this" is what the eye
// lands on.
export function EvidenceCard({ fig }: { fig: Dict["teams"]["fig"] }) {
  // Highlight the first two clauses of the answer as "the phrases it relied on".
  const parts = fig.answer.split(/(?<=,)\s/);
  return (
    <div role="img" aria-label={`${fig.answerLabel}: ${fig.answer} ${fig.draft}: ${fig.band}, ${fig.score}. ${fig.stamp}.`} className="select-none">
      <p className="text-mono-label text-muted">{fig.answerLabel}</p>
      <p className="mt-2 text-base text-foreground">
        {parts.map((p, i) => (
          <span key={i} className={i < 2 ? "bg-accent-soft rounded-sm px-0.5" : ""}>
            {p}{" "}
          </span>
        ))}
      </p>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-line pt-4">
        <div>
          <p className="text-mono-label text-muted">{fig.draft}</p>
          <p className="mt-1 text-title text-foreground">{fig.band}</p>
        </div>
        <p className="text-display text-foreground tabular-nums" aria-hidden>
          {fig.score}
        </p>
      </div>
      <p className="mt-4 inline-flex items-center gap-2 rounded-md bg-good-soft px-3 py-1.5 text-sm font-semibold text-good">
        <Icon name="check" className="w-4 h-4" />
        {fig.stamp}
      </p>
    </div>
  );
}
