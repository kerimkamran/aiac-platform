import Link from "next/link";
import { Icon, Logo } from "@/components/ui";

/* Split-screen auth layout: brand panel left, form right. */
export function AuthPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-background">
      <aside className="hidden lg:flex relative hero-mesh text-white flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 hero-grid-overlay" aria-hidden />
        <Link href="/" className="relative">
          <Logo dark />
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold tracking-tight leading-tight [font-family:var(--font-display)]">
            Every score backed by evidence. Every decision confirmed by a human.
          </h2>
          <ul className="mt-8 space-y-4">
            {[
              "Structured assessments mapped to 37 governed competencies",
              "AI-assisted scoring with a written rationale per answer",
              "Reviewer-confirmed shortlist, hold, and reject decisions",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-[14.5px] text-white/75">
                <span className="w-5 h-5 rounded-full bg-accent/20 text-accent grid place-items-center shrink-0 mt-0.5">
                  <Icon name="check" className="w-3 h-3" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[12px] text-white/40">Azerconnect Group — Internal Use Only · AIAC v1.0</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm anim-fade-up">
          <Link href="/" className="lg:hidden inline-block mb-8">
            <Logo />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground [font-family:var(--font-display)]">{title}</h1>
          <p className="text-sm text-muted mt-2 mb-8">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}

export function Field({
  label,
  name,
  type,
  placeholder,
  minLength,
}: {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  minLength?: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-[13px] font-semibold text-foreground mb-1.5">
        {label}
      </label>
      <input
        id={name}
        type={type}
        name={name}
        required
        minLength={minLength}
        placeholder={placeholder}
        className="w-full bg-surface border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-shadow"
      />
    </div>
  );
}
