import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: {
    default: "AIAC — AI Assessment Center by AG",
    template: "%s · AIAC",
  },
  description:
    "Azerconnect Group's AI-powered competency assessment platform — structured assessments, evidence-based scoring across a governed 37-competency framework, and confident hiring decisions.",
  openGraph: {
    title: "AIAC — AI Assessment Center by AG",
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
    <html lang="en" className={`h-full antialiased ${inter.variable} ${sora.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
