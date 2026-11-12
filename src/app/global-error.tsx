"use client";

import "./globals.css";

// Last-resort boundary: replaces the root layout, so it carries its own
// <html> and <body>. Plain markup only; nothing here can itself fail.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-3xl px-6 py-24">
          <h1 className="text-display">Something went wrong on our side.</h1>
          <p className="mt-3 text-body-large text-muted">You can try again, or go back home.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" onClick={reset} className="min-h-12 rounded-md bg-brand px-6 text-base font-semibold text-on-primary hover:bg-brand-hover">
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the router may be unavailable in the last-resort boundary */}
            <a href="/" className="inline-flex min-h-12 items-center rounded-md px-6 text-base font-semibold text-foreground ring-1 ring-inset ring-line-control">
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
