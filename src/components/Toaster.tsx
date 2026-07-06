"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui";

type ToastVariant = "success" | "error" | "info";
type ToastItem = { id: number; variant: ToastVariant; message: string };

const ToastContext = createContext<{ push: (variant: ToastVariant, message: string) => void } | null>(null);

const VARIANT_META: Record<ToastVariant, { icon: string; ring: string; iconWrap: string }> = {
  success: { icon: "checkCircle", ring: "ring-accent/25", iconWrap: "bg-accent-soft text-accent-dark" },
  error: { icon: "alertTriangle", ring: "ring-red-200", iconWrap: "bg-red-50 text-critical" },
  info: { icon: "info", ring: "ring-line", iconWrap: "bg-surface text-brand" },
};

const DURATION_MS = 5200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, variant, message }]);
      window.setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed z-[100] bottom-4 right-4 left-4 sm:left-auto flex flex-col-reverse gap-2.5 pointer-events-none no-print">
        {toasts.map((t) => {
          const meta = VARIANT_META[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              className={`anim-toast-in pointer-events-auto relative overflow-hidden w-full sm:w-96 bg-surface border border-line rounded-2xl shadow-xl ring-1 ${meta.ring} px-4 pt-3.5 pb-4 flex items-start gap-3`}
            >
              <span className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${meta.iconWrap}`}>
                <Icon name={meta.icon} className="w-4 h-4" />
              </span>
              <p className="text-[13px] leading-snug text-foreground flex-1 pt-0.5">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="text-faint hover:text-foreground shrink-0 -mt-0.5 -mr-1 p-1"
              >
                <Icon name="x" className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-0 left-0 h-0.5 w-full bg-line/60">
                <div
                  className="h-full bg-brand/60 anim-toast-bar"
                  style={{ animationDuration: `${DURATION_MS}ms` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export type ToastSpec = {
  /** Query param whose presence (non-empty) triggers this toast. */
  param: string;
  variant?: ToastVariant;
  /** Custom message builder; defaults to decodeURIComponent(value). */
  message?: (value: string, all: URLSearchParams) => string;
  /** Extra params to strip from the URL alongside `param` (defaults to [param]). */
  clearParams?: string[];
};

function ToastFromParamsInner({ specs }: { specs: ToastSpec[] }) {
  const { push } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const processedRef = useRef<string | null>(null);

  useEffect(() => {
    const raw = searchParams.toString();
    if (processedRef.current === raw) return;
    processedRef.current = raw;

    const toClear = new Set<string>();
    let fired = false;
    for (const spec of specs) {
      const value = searchParams.get(spec.param);
      if (value === null || value === "") continue;
      fired = true;
      const message = spec.message ? spec.message(value, searchParams) : decodeURIComponent(value);
      push(spec.variant || "info", message);
      (spec.clearParams || [spec.param]).forEach((p) => toClear.add(p));
    }

    if (fired) {
      const next = new URLSearchParams(searchParams.toString());
      toClear.forEach((p) => next.delete(p));
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}

/** Drop into any page: watches known query params, shows a toast, then cleans the URL. */
export function ToastFromParams({ specs }: { specs: ToastSpec[] }) {
  return (
    <Suspense fallback={null}>
      <ToastFromParamsInner specs={specs} />
    </Suspense>
  );
}
