import type { ButtonHTMLAttributes, ReactNode } from "react";

// Button primitive (plan v2, section 4.3): pill-shaped, 40px by default and
// 48px for primary actions. Every variant has a visible focus ring.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-deep text-on-primary hover:bg-brand-hover active:bg-brand-pressed",
  secondary: "bg-surface text-foreground ring-1 ring-inset ring-line-control hover:bg-line-soft",
  ghost: "text-accent-dark hover:bg-accent-soft",
  danger: "bg-critical text-surface hover:opacity-90",
};

const SIZE: Record<ButtonSize, string> = {
  md: "min-h-10 px-5 text-sm",
  lg: "min-h-12 px-6 text-base",
};

export function buttonClass({ variant = "primary", size = "md", className = "" }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANT[variant],
    SIZE[size],
    className,
  ].join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; children: ReactNode }) {
  return (
    <button type="button" {...rest} className={buttonClass({ variant, size, className })}>
      {children}
    </button>
  );
}
