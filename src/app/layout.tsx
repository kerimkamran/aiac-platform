import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

// Node Grid type system (plan v2, section 4.2). Manrope carries headings and
// large numbers; Inter carries everything else. Both load the Latin-extended
// and Cyrillic subsets so Azerbaijani (ə ğ ı ş) and Russian render correctly;
// the old setup loaded basic Latin only, which broke those letters.
const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});
const manrope = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-manrope",
  weight: ["600", "700", "800"],
});

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
  // This inline script is the only one the app needs. It runs before first
  // paint so the saved theme and canvas are applied with no flash. middleware.ts
  // mints a per-request nonce and only allows a script carrying it.
  const nonce = (await headers()).get("x-nonce") || undefined;

  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${manrope.variable}`}>
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
    var canvas = saved && saved.canvas ? saved.canvas : "white";
    if (canvas !== "cream" && canvas !== "grey") canvas = "white";
    if (canvas !== "white") document.documentElement.setAttribute("data-canvas", canvas);
  } catch (e) {}
})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
