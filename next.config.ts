import type { NextConfig } from "next";

// Design-execution-plan Phase 6 / T6.5: Content-Security-Policy used to live
// here as a static header with `script-src 'self' 'unsafe-inline'` -- which
// lets ANY inline script run, including one an attacker manages to inject,
// not just the one legitimate inline script this app actually ships (the
// anti-flash theme setter in layout.tsx <head>). CSP now moves to
// middleware.ts, which mints a fresh nonce per request and only allows
// script tags carrying it; that needs per-request randomness a static
// next.config header can't provide, so it's no longer listed below.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Word job descriptions go through a server action. The default limit is 1 MB;
  // Vercel itself refuses request bodies above 4.5 MB, so 4 MB is the most that works.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // The decision-maker portal was removed. Old links land on the staff pages.
  async redirects() {
    return [
      { source: "/candidate/signoffs", destination: "/signoffs", permanent: false },
      { source: "/decision", destination: "/staff", permanent: false },
      { source: "/decision/candidates/:id", destination: "/staff/reports/candidates/:id", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
