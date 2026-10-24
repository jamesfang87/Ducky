import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages that need a signed-in user. Everything else (landing, /login, /privacy) is public.
const PROTECTED = ["/teacher", "/session"];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Supabase falls back to the Site URL when a redirect isn't allow-listed, which drops the
  // OAuth ?code on whatever page that is. Forward it to the real callback instead of losing it.
  if (searchParams.has("code") && pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !supaKey) return NextResponse.next(); // not configured: keep the mock demo working

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supaUrl, supaKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
