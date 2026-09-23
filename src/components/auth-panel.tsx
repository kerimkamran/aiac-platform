import Link from "next/link";
import { LogoMark } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScoutLauncher } from "@/components/ScoutLauncher";

// Design-execution-plan follow-up ("make it simple like Google"): this used
// to be a split-screen layout (a wide brand panel with a headline, a
// feature-benefit list, and a footer, alongside a narrower form column) --
// a lot of screen for a visitor to read before they can type an email.
// Replaced with a single centered column: mark, one line of context, the
// form, nothing beside it. Matches how Google's own account/sign-in pages
// read -- one focal box on an otherwise empty page.
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
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-16">
        <Link href="/" className="mb-7">
          <LogoMark className="w-11 h-11" />
        </Link>
        <div className="w-full max-w-sm anim-fade-up text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground [font-family:var(--font-display)]">{title}</h1>
          <p className="text-sm text-muted mt-2 mb-8">{subtitle}</p>
          <div className="text-left">{children}</div>
        </div>
      </main>

      <footer className="flex items-center justify-center gap-4 px-6 py-6 text-2xs text-muted">
        <span>Azerconnect Group — Internal Use Only</span>
        <ThemeToggle className="text-muted hover:text-muted transition-colors" />
      </footer>

      <ScoutLauncher role="visitor" />
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
      <label htmlFor={name} className="block text-xs font-semibold text-foreground mb-1.5">
        {label}
      </label>
      <input
        id={name}
        type={type}
        name={name}
        required
        minLength={minLength}
        placeholder={placeholder}
        className="w-full bg-background border border-line rounded-md px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-shadow"
      />
    </div>
  );
}
