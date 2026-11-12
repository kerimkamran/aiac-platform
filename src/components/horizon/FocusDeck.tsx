import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PrimaryCard } from "@/components/ui/Surfaces";

// A deck of one: the review queue shown one candidate at a time (Clear Horizon
// plan, section 10). The page owns the position (?i=); this renders the card,
// the position, and previous / next links. Nothing here changes data.
export function FocusDeck({
  index,
  total,
  title,
  meta,
  children,
  openHref,
  prevHref,
  nextHref,
  openLabel = "Open review",
}: {
  index: number;
  total: number;
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  openHref: string;
  prevHref?: string;
  nextHref?: string;
  openLabel?: string;
}) {
  return (
    <section aria-label="Review deck">
      <p className="text-mono-label text-muted" aria-live="polite">
        {index + 1} / {total}
      </p>
      <PrimaryCard className="mt-3 p-6 sm:p-8">
        <h2 className="text-headline text-foreground">{title}</h2>
        {meta && <p className="mt-1 text-base text-muted">{meta}</p>}
        {children && <div className="mt-5">{children}</div>}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <ButtonLink href={openHref} size="lg">
            {openLabel}
            <Icon name="arrowRight" className="w-4 h-4 ml-2" />
          </ButtonLink>
          {nextHref && (
            <ButtonLink href={nextHref} variant="secondary" size="lg">
              Skip for now
            </ButtonLink>
          )}
        </div>
      </PrimaryCard>
      <div className="mt-4 flex items-center justify-between text-sm">
        {prevHref ? (
          <Link href={prevHref} className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent hover:underline">
            <Icon name="chevronLeft" className="w-4 h-4" /> Previous
          </Link>
        ) : (
          <span />
        )}
        {nextHref && (
          <Link href={nextHref} className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent hover:underline">
            Next <Icon name="chevronRight" className="w-4 h-4" />
          </Link>
        )}
      </div>
    </section>
  );
}
