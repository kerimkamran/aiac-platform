import type { ButtonHTMLAttributes } from "react";
import { Icon } from "@/components/ui/Icon";

// An icon-only button with a 44px touch target and a required accessible name.
export function IconButton({
  icon,
  label,
  className = "",
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & { icon: string; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={`press inline-flex items-center justify-center w-11 h-11 rounded-md text-muted hover:text-foreground hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50 ${className}`}
    >
      <Icon name={icon} className="w-5 h-5" />
    </button>
  );
}
