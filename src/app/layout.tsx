import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// v4 type system: a single neutral workhorse face (Inter) for everything,
// body and headlines alike. The previous two-font pairing (a "geometric,
// warm" body face plus a separate "confident" display face) was itself
// part of what read as a templated AI-generated product -- hierarchy here
// comes from size, weight, and spacing, not from switching typefaces.
// Variable names (--font-nunito, --font-serif) are kept unchanged so every
// consuming component keeps working without a mechanical rename.
const inter = Inter({ subsets: ["latin"], variable: "--font-nunito", weight: ["400", "500", "600", "700", "800"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });
const interDisplay = Inter({ subsets: ["latin"], variable: "--font-serif", weight: ["500", "600", "700"] });

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
    <html lang="en" className={`h-full antialiased ${inter.variable} ${mono.variable} ${interDisplay.variable}`}>
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
