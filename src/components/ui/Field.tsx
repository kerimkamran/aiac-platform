import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// Form primitives (plan v2, section 4.3): 12px radius, 40px minimum height,
// a control border that meets the 3:1 contrast rule, and the shared focus ring.
const CONTROL =
  "w-full bg-surface border border-line-control rounded-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted " +
  "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-focus disabled:opacity-50";

export function FieldLabel({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {children}
      </label>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} min-h-10 ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} min-h-10 ${props.className ?? ""}`} />;
}
