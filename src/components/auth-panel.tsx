import Link from "next/link";
import { Icon, Logo } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";

/* Split-screen auth layout: warm brand panel left, form right. */
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
      <aside className="hidden lg:flex relative hero-warm border-r border-line flex-col justify-between p-12 overflow-hidden">
        <Link href="/" className="relative">
          <Logo />
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-[34px] font-semibold tracking-tight leading-[1.15] text-foreground [font-family:var(--font-display)]">
            Every score backed by <em className="text-accent-dark">evidence</em>. Every decision confirmed by a human.
          </h2>
          <ul className="mt-9 space-y-4">
            {[
              "Structured assessments mapped to 37 governed competencies",
              "AI-assisted scoring with a written rationale per answer",
              "Reviewer-confirmed shortlist, hold, and reject decisions",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-[14.5px] text-muted">
                <span className="w-5 h-5 rounded-full bg-accent-soft text-accent-dark grid place-items-center shrink-0 mt-0.5">
                  <Icon name="check" className="w-3 h-3" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center justify-between gap-3 text-[12px] text-faint">
          <p>Azerconnect Group — Internal Use Only · AIAC v1.0</p>
          <div className="flex items-center gap-3">
            <ThemeToggle className="text-faint hover:text-muted transition-colors" />
            <a
              href="https://linkedin.com/in/kamrankarimli"
              target="_blank"
              rel="noreferrer"
              className="text-faint hover:text-muted transition-colors whitespace-nowrap"
            >
              Developed by Kamran Karimli
            </a>
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center px-5 py-12 bg-surface">
        <div className="w-full max-w-sm anim-fade-up">
          <Link href="/" className="lg:hidden inline-block mb-8">
            <Logo />
          </Link>
          <h1 className="text-[26px] font-semibold tracking-tight text-foreground [font-family:var(--font-display)]">{title}</h1>
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
        className="w-full bg-background/60 border border-line rounded-xl px-3.5 py-2.5 text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-shadow"
      />
    </div>
  );
}
