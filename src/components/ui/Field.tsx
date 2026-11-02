import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// Form primitives (Clear Horizon plan, section 16): 8px radius, 40px minimum
// height (48px on sign-in), a control border that meets the 3:1 contrast rule,
// and the shared focus ring. TextField adds the label, hint and error with the
// right aria wiring, so a page never hand-rolls them.
export type FieldSize = "md" | "lg";

const CONTROL =
  "w-full bg-surface border border-line-control rounded-md px-3.5 text-base text-foreground placeholder:text-muted " +
  "transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus " +
  "aria-[invalid=true]:border-critical disabled:opacity-50";
const HEIGHT: Record<FieldSize, string> = { md: "min-h-10 py-2", lg: "min-h-12 py-3" };

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

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-critical">
      {children}
    </p>
  );
}

export function Input({ fieldSize = "md", className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { fieldSize?: FieldSize }) {
  return <input {...props} className={`${CONTROL} ${HEIGHT[fieldSize]} ${className}`} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} py-2.5 ${className}`} />;
}

export function Select({ className = "", fieldSize = "md", ...props }: SelectHTMLAttributes<HTMLSelectElement> & { fieldSize?: FieldSize }) {
  return <select {...props} className={`${CONTROL} ${HEIGHT[fieldSize]} ${className}`} />;
}

// Label, control, hint and error in one. Pass the control's props through.
export function TextField({
  label,
  hint,
  error,
  fieldSize = "md",
  className = "",
  id,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { label: ReactNode; hint?: ReactNode; error?: ReactNode; fieldSize?: FieldSize }) {
  const auto = useId();
  const fid = id ?? auto;
  const errId = `${fid}-error`;
  const hintId = `${fid}-hint`;
  return (
    <div className={className}>
      <FieldLabel htmlFor={fid}>{label}</FieldLabel>
      <input
        {...props}
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined}
        className={`${CONTROL} ${HEIGHT[fieldSize]}`}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={errId}>{error}</FieldError>}
    </div>
  );
}

// Checkbox and radio: a 44px touch target around a 20px control (48px on
// sign-in with size "lg").
const CHECK = "shrink-0 w-5 h-5 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function Checkbox({
  label,
  size = "md",
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & { label: ReactNode; size?: FieldSize }) {
  return (
    <label className={`flex items-center gap-3 cursor-pointer ${size === "lg" ? "min-h-12" : "min-h-11"} ${className}`}>
      <input type="checkbox" {...props} className={CHECK} />
      <span className="text-base text-foreground">{label}</span>
    </label>
  );
}

export function Radio({
  label,
  size = "md",
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & { label: ReactNode; size?: FieldSize }) {
  return (
    <label className={`flex items-center gap-3 cursor-pointer ${size === "lg" ? "min-h-12" : "min-h-11"} ${className}`}>
      <input type="radio" {...props} className={CHECK} />
      <span className="text-base text-foreground">{label}</span>
    </label>
  );
}
