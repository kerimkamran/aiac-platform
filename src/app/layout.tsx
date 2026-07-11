import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Rebrand type system: Plus Jakarta Sans (geometric, warm) for body/UI text,
// Space Grotesk (confident, geometric-grotesque display) for headlines --
// replacing the previous Nunito + italic-serif editorial pairing with a
// sharper, more "product" feel that matches the new Vantage identity.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-nunito", weight: ["400", "500", "600", "700", "800"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-serif", weight: ["400", "500", "600", "700"] });

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${jakarta.variable} ${mono.variable} ${grotesk.variable}`}>
      <head>
        <script
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
