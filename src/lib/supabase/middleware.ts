import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/home";

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

  const protectedPrefixes = ["/candidate", "/staff", "/admin", "/report", "/api/v1", "/api/search"];
  const isProtected = protectedPrefixes.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && isProtected) {
    // Send the visitor to sign-in and remember where they were going, so an
    // emailed deep link returns there afterwards. The path is validated so it
    // can never redirect to another site.
    const url = request.nextUrl.clone();
    const target = safeNextPath(request.nextUrl.pathname + request.nextUrl.search);
    url.pathname = "/login";
    url.search = "";
    if (target && request.method === "GET") url.searchParams.set("next", target);
    return NextResponse.redirect(url);
  }

  // A suspended or deactivated account loses access at once, on every
  // protected page, route and action (not only on the next sign-in).
  if (user && isProtected) {
    const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();
    if (profile && profile.status !== "active") {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?error=inactive";
      const res = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
      return res;
    }
  }

  return supabaseResponse;
}
