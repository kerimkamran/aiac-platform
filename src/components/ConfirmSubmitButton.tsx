"use client";

import { Icon } from "@/components/ui";

export function ConfirmSubmitButton({
  confirmMessage,
  className = "",
  icon,
  children,
}: {
  confirmMessage: string;
  className?: string;
  icon?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {icon && <Icon name={icon} className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}
