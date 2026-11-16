import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

// A home screen that is a menu of things to do: each tile is one function,
// one tap away, with a live count where a count helps. Tiles rise in one after
// another, the icon fills with the brand colour on hover and the arrow leans
// forward. The first tile can be marked as the main action.
export type LauncherTile = {
  href: string;
  title: string;
  body: string;
  icon: string;
  // A live number shown on the tile, for example people waiting.
  count?: number;
  countLabel?: string;
  // The main action on this screen: filled with the brand colour.
  primary?: boolean;
};

export function HomeLauncher({ tiles, label }: { tiles: LauncherTile[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t, i) => {
          const hasCount = typeof t.count === "number";
          const attention = hasCount && (t.count as number) > 0;
          return (
            <li key={t.href} className="min-w-0">
              <Link
                href={t.href}
                style={{ "--i": i } as React.CSSProperties}
                className={`launch-tile group relative flex h-full min-h-36 flex-col rounded-card border p-5 transition-[border-color,box-shadow,transform] duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  t.primary
                    ? "border-brand bg-brand text-on-primary"
                    : "border-line bg-surface text-foreground hover:border-accent"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200 ${
                      t.primary
                        ? "bg-on-primary/15 text-on-primary"
                        : "bg-accent-soft text-accent group-hover:bg-brand group-hover:text-on-primary"
                    }`}
                  >
                    <Icon name={t.icon} className="h-6 w-6" />
                  </span>
                  {hasCount && (
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
                        t.primary
                          ? "bg-on-primary text-brand"
                          : attention
                            ? "bg-brand text-on-primary"
                            : "bg-surface-sunken text-muted"
                      }`}
                    >
                      {t.count}
                      {t.countLabel ? <span className="sr-only"> {t.countLabel}</span> : null}
                    </span>
                  )}
                </div>
                <p className="mt-4 text-lg font-semibold">{t.title}</p>
                <p className={`mt-1 text-sm ${t.primary ? "text-on-primary/85" : "text-muted"}`}>{t.body}</p>
                <Icon
                  name="arrowRight"
                  className={`launch-arrow absolute bottom-5 right-5 h-5 w-5 ${t.primary ? "text-on-primary" : "text-muted group-hover:text-accent"}`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
