"use client";

// Pill-shaped segmented control (plan v2, section 4.3). Used for the theme and
// background choices in the Appearance menu. Each option is a button with
// aria-pressed, so keyboard and screen-reader users hear the selection.
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 p-1 rounded-full bg-surface-sunken ring-1 ring-inset ring-line">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`min-h-9 px-3.5 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus disabled:opacity-50 ${
              on ? "bg-brand-deep text-on-primary" : "text-foreground hover:bg-line-soft"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
