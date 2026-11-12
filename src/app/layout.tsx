import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { headers } from "next/headers";
import { getLang } from "@/i18n/server";
import "./globals.css";

// Clear Horizon type system (design plan, section 6). Inter is a variable font
// with the optical-size axis, so large sizes automatically use the tighter
// Inter Display cut. Geist Mono carries the exam timer, figure labels and IDs.
// Both load the Latin, Latin-extended and Cyrillic subsets, so Azerbaijani
// (Ə ə İ ı ş ç ğ) and Russian render correctly. Onest is retired; Manrope
// cannot be used because it has no capital Ə.
const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  axes: ["opsz"],
  display: "swap",
});
const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // The public pages stay out of search engines until Azerconnect Comms and
  // Legal approve them (design plan, section 20).
  robots: { index: false, follow: false },
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
  // This inline script is the only one the app needs. It runs before first
  // paint so the saved theme and canvas are applied with no flash. middleware.ts
  // mints a per-request nonce and only allows a script carrying it.
  const nonce = (await headers()).get("x-nonce") || undefined;
  const lang = await getLang();

  return (
    <html lang={lang} className={`h-full antialiased ${inter.variable} ${geistMono.variable}`}>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function () {
  try {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem("vantage-appearance") || "null"); } catch (e) {}
    var theme = saved && saved.theme ? saved.theme : localStorage.getItem("aiac-theme");
    if (theme !== "light" && theme !== "dark") theme = "system";
    var dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
    var canvas = saved && saved.canvas ? saved.canvas : null;
    if (canvas === "white" || canvas === "cream" || canvas === "grey") document.documentElement.setAttribute("data-canvas", canvas);
  } catch (e) {}
})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
