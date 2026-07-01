import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Assessment Center by AG",
  description: "Azerconnect Group — AI-powered competency assessment platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
