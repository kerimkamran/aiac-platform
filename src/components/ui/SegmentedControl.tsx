"use client";

// Segmented control (Clear Horizon plan, section 16): 8px radius, used for
// theme and background in the account menu, and for language. Each option is a
// button with aria-pressed, so keyboard and screen-reader users hear the
// selection.
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className = "",
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`inline-flex flex-wrap gap-1 p-1 rounded-md bg-surface-sunken ring-1 ring-inset ring-line ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`press min-h-9 px-3.5 rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus disabled:opacity-50 ${
              on ? "bg-brand text-on-primary" : "text-foreground hover:bg-line-soft"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
