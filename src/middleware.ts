import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Design-execution-plan Phase 6 / T6.5: builds the app's CSP with a fresh
// nonce per request instead of the blanket `script-src 'self' 'unsafe-inline'`
// that used to live as a static header in next.config.ts -- that let ANY
// inline script run, not just the one this app actually ships (the
// anti-flash theme setter in layout.tsx's <head>). Only a script tag
// carrying this exact nonce is allowed to run now.
function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.moonshot.ai",
    "media-src 'self' blob: https://*.supabase.co",
    "frame-ancestors 'none'",
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  // A *new* Headers object, not a mutation of `request.headers` in place --
  // `NextResponse.next({ request: { headers } })` is what actually threads
  // this into the Server Components rendered for this request, letting
  // layout.tsx read it back via `headers()` from `next/headers`.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = await updateSession(request, requestHeaders);
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
