import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

// v4 type system: a single neutral workhorse face (Inter) for everything,
// body and headlines alike. The previous two-font pairing (a "geometric,
// warm" body face plus a separate "confident" display face) was itself
// part of what read as a templated AI-generated product -- hierarchy here
// comes from size, weight, and spacing, not from switching typefaces.
//
// Design-execution-plan Phase 1 / T1.3: this used to be TWO separate
// `Inter({...})` calls -- each is its own font resource with its own
// network requests -- assigned to variables misleadingly still named
// --font-nunito and --font-serif, leftovers from the pre-"v4 Field"
// pairing where those names were accurate. Loading the same family twice
// bought nothing (both instances covered overlapping weights) and the
// variable names actively lied about what they held. Now loaded once,
// with every weight either use needs, under a name that describes it;
// globals.css's `@theme inline` block still exposes both a `--font-sans`
// and a `--font-display` Tailwind alias pointing at this one resource, so
// no component needing that body/display utility distinction has to change.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600", "700", "800"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: {
    default: "Vantage — Competency Intelligence by Azerconnect Group",
    template: "%s · Vantage",
  },
  description:
    "Vantage is Azerconnect Group's AI-powered competency assessment platform — structured assessments, evidence-based scoring across a governed 37-competency framework, and confident hiring decisions.",
  openGraph: {
    title: "Vantage — Competency Intelligence by Azerconnect Group",
    description: "Competency-based hiring, powered by AI. Built on Azerconnect's governed 37-competency framework.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Design-execution-plan Phase 6 / T6.5: this is the app's one legitimate
  // inline script (it has to run before first paint to avoid a light-mode
  // flash on a dark-mode visit) -- previously allowed by a blanket
  // `script-src 'self' 'unsafe-inline'` in the CSP, which permits any inline
  // script, attacker-injected ones included. middleware.ts now mints a
  // per-request nonce and only allows a script carrying it; this reads that
  // nonce back off the request headers it was threaded through.
  const nonce = (await headers()).get("x-nonce") || undefined;

  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${mono.variable}`}>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try {
              var t = localStorage.getItem("aiac-theme");
              if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
                document.documentElement.classList.add("dark");
              }
            } catch (e) {}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
