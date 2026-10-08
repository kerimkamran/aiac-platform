import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// `requestHeaders`, when passed, replaces `request`'s own headers on every
// `NextResponse.next({ request })` call below -- this is how the per-request
// CSP nonce middleware.ts generates (see the comment there) actually reaches
// the Server Components rendered for this request, not just the outgoing
// response. Optional so this function still works untouched wherever a nonce
// isn't relevant.
export async function updateSession(request: NextRequest, requestHeaders?: Headers) {
  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders ?? request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders ?? request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPrefixes = ["/candidate", "/staff", "/admin", "/decision", "/report", "/api/v1", "/api/search"];
  const isProtected = protectedPrefixes.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
