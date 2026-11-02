"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

// A submit button that reads the surrounding form's status, so every server
// action form gets the same pending state without wiring it by hand.
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  block = false,
  className = "",
  disabled,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} block={block} className={className} pending={pending} pendingLabel={pendingLabel} disabled={disabled}>
      {children}
    </Button>
  );
}
