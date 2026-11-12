import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

// Button (Clear Horizon plan, section 16): 8px radius, sizes 32 / 40 / 48,
// five variants and a pending state ("Signing in…"). Pages may not hand-roll
// buttons; every call site uses this component or `buttonClass`.
//
// "panel" and "panelGhost" are for the one navy brand panel on a screen.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "panel" | "panelGhost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-primary hover:bg-brand-hover active:bg-brand-pressed",
  secondary: "bg-surface text-foreground ring-1 ring-inset ring-line-control hover:bg-surface-sunken",
  ghost: "text-accent hover:bg-accent-soft",
  danger: "bg-critical text-on-critical hover:opacity-90",
  panel: "bg-on-panel text-panel hover:opacity-90",
  panelGhost: "text-on-panel ring-1 ring-inset ring-panel-line hover:bg-on-panel/10",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-8 px-3 text-sm",
  md: "min-h-10 px-4 text-sm",
  lg: "min-h-12 px-6 text-base",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className = "",
  block = false,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string; block?: boolean } = {}) {
  return [
    "press inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none",
    VARIANT[variant],
    SIZE[size],
    block ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  // While true the button is disabled, announces itself as busy and shows
  // `pendingLabel` (for example "Signing in…") instead of its children.
  pending?: boolean;
  pendingLabel?: ReactNode;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  pending = false,
  pendingLabel,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClass({ variant, size, className, block })}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

// A link that looks like a button.
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  block = false,
  className = "",
  children,
  ...rest
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} {...rest} className={buttonClass({ variant, size, className, block })}>
      {children}
    </Link>
  );
}
