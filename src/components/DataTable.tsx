import Link from "next/link";
import { Card, Icon } from "@/components/ui";

// Design-execution-plan Phase 5 / T5.2: candidates, users and audit each
// re-implemented their own <table> -- same overall shape (Card wrapper,
// text-2xs uppercase header, divide-y rows, a colSpan "no results" row) but
// copy-pasted three times with small, silent drifts (only users had sort
// links; only audit had no zebra hover; only candidates had row selection).
// One primitive here instead: callers describe columns and rows, this
// component owns the table markup plus the loading/error/empty states the
// plan calls for, so those three states -- not just the success path -- are
// consistent everywhere a table appears, including places that never had a
// loading or error state of their own before. Deliberately framework-plain
// (no client state, no generic sort/filter logic of its own): every current
// caller is a server component driving sort/filter/pagination through URL
// search params and <Link>s, and this component fits that pattern rather
// than inventing a second one.

export type DataTableColumn<T> = {
  /** Stable key for this column -- used as the React key, not shown. */
  key: string;
  /** Header content. Ignored if headerRender is given. */
  label?: React.ReactNode;
  /** Full control over the header cell's content, e.g. a select-all checkbox. */
  headerRender?: () => React.ReactNode;
  /** Cell content for one row. */
  render: (row: T) => React.ReactNode;
  align?: "left" | "right";
  /** If set, the header becomes a link that re-sorts by this column (a full
   *  href with the rest of the current filters/page already encoded --
   *  callers build it, matching how they already build filter/page hrefs). */
  sortHref?: string;
  /** "asc" | "desc" when this column is the current sort, else undefined. */
  sortActive?: "asc" | "desc";
  /** Extra classes for both the <th> and every <td> in this column, e.g. a
   *  fixed width ("w-10") for a checkbox column. */
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  density = "comfortable",
  loading = false,
  error = null,
  emptyMessage = "No results.",
  minWidthClassName = "min-w-[680px]",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Visually hidden <caption> -- what this table is a table of, for screen
   *  reader users who jump straight to it via table navigation. */
  caption?: string;
  density?: "comfortable" | "compact";
  /** Shows skeleton rows instead of `rows`. For a table whose data streams in
   *  after first paint (e.g. behind a client fetch or a Suspense boundary) --
   *  none of today's callers need it yet since they're all server-rendered,
   *  but the plan calls for the state to exist on the primitive itself. */
  loading?: boolean;
  /** Shows a single error row instead of `rows` when set. */
  error?: string | null;
  emptyMessage?: React.ReactNode;
  minWidthClassName?: string;
}) {
  const cellPad = density === "compact" ? "px-4 py-2" : "px-5 py-3.5";
  const headPad = density === "compact" ? "px-4 py-2.5" : "px-5 py-3.5";

  return (
    <Card className="overflow-x-auto">
      <table className={`w-full text-sm ${minWidthClassName}`}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="text-muted text-2xs uppercase tracking-wider border-b border-line">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`${headPad} font-semibold ${col.align === "right" ? "text-right" : "text-left"} ${col.className || ""}`}
              >
                {col.headerRender ? (
                  col.headerRender()
                ) : col.sortHref ? (
                  <Link href={col.sortHref} className={`hover:text-foreground ${col.sortActive ? "text-accent-dark" : ""}`}>
                    {col.label} {col.sortActive === "asc" ? "↑" : col.sortActive === "desc" ? "↓" : ""}
                  </Link>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={columns.length} className={cellPad}>
                  <div className="h-4 rounded bg-line/60 animate-pulse" style={{ width: `${55 + ((i * 11) % 35)}%` }} />
                </td>
              </tr>
            ))
          ) : error ? (
            <tr>
              <td colSpan={columns.length} className={`${cellPad} py-12`}>
                <span className="flex items-center justify-center gap-2 text-sm text-critical">
                  <Icon name="alertTriangle" className="w-4 h-4 shrink-0" />
                  {error}
                </span>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={`${cellPad} py-12 text-center text-muted text-sm`}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className="hover:bg-background/70 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`${cellPad} ${col.align === "right" ? "text-right" : ""} ${col.className || ""}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

/** Pairs with DataTable for the same Previous/Next pattern every paginated
 * table already used, slightly differently each time -- one implementation. */
export function DataTablePagination({
  pageNum,
  totalPages,
  makeHref,
  total,
}: {
  pageNum: number;
  totalPages: number;
  makeHref: (page: number) => string;
  /** Total row count, if known -- shown alongside the page count. */
  total?: number;
}) {
  if (totalPages <= 1 && total === undefined) return null;
  return (
    <div className="flex items-center justify-between mt-5 text-sm">
      <p className="text-muted">
        Page {pageNum} of {totalPages}
        {total !== undefined ? ` · ${total} total` : ""}
      </p>
      <div className="flex gap-2">
        {pageNum > 1 && (
          <Link href={makeHref(pageNum - 1)} className="border border-line rounded-xl px-4 py-2 font-semibold text-foreground hover:border-brand">
            Previous
          </Link>
        )}
        {pageNum < totalPages && (
          <Link href={makeHref(pageNum + 1)} className="border border-line rounded-xl px-4 py-2 font-semibold text-foreground hover:border-brand">
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
