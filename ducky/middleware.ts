import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS, REMEMBER_COOKIE, withLifetime } from "@/lib/supabase/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { homePath, type Role } from "@/lib/users";
import { mfaSatisfied } from "@/lib/mfa";

/** Route gates. Runs before the page renders, so a student typing /teacher never sees a teacher screen. */
const RULES: { pattern: RegExp; roles: Role[] }[] = [
  { pattern: /^\/teacher(?:\/|$)/, roles: ["teacher"] },
  { pattern: /^\/classes(?:\/|$)/, roles: ["student", "teacher"] }, // teachers can be students in other people's classes
  { pattern: /^\/session(?:\/|$)/, roles: ["student", "teacher"] },
];

export async function middleware(req: NextRequest) {
  const { pathname, search, searchParams } = req.nextUrl;

  // If Supabase can't honor our redirect URL it falls back to the Site URL and the
  // OAuth ?code lands on the wrong page. Forward it to the callback instead of losing it.
  if (searchParams.has("code") && pathname !== "/auth/callback") {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  const rule = RULES.find((r) => r.pattern.test(pathname));
  // Already signed in? Skip the login page (unless it's showing an error) instead of making them sign in again.
  const isLogin = pathname === "/login" && !searchParams.has("error");
  if (!rule && !isLogin) return NextResponse.next(); // public page (landing, privacy)

  // Fail closed: without Supabase keys nobody gets into protected pages (and nothing crashes).
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !supaKey) {
    if (isLogin) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("error", "Sign-in is not configured on this deployment yet.");
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(supaUrl, supaKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => req.cookies.set(name, value));
        response = NextResponse.next({ request: req });
        const remember = req.cookies.get(REMEMBER_COOKIE)?.value;
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, withLifetime(options, remember)));
      },
    },
  });

  const redirectTo = (path: string, withNext = true) => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (withNext) url.searchParams.set("next", `${pathname}${search}`);
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c)); // keep refreshed auth cookies
    return res;
  };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return isLogin ? response : redirectTo("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!mfaSatisfied(aal)) return isLogin ? response : redirectTo("/mfa");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role as Role | undefined;
  if (role !== "student" && role !== "teacher") return isLogin ? response : redirectTo("/login", false);

  if (isLogin) {
    const next = searchParams.get("next");
    const url = req.nextUrl.clone();
    url.pathname = next && next.startsWith("/") && !next.startsWith("//") ? next : homePath(role);
    url.search = "";
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  }

  if (!rule!.roles.includes(role)) return redirectTo(homePath(role), false);

  return response;
}

// The login, MFA, callback and public pages deliberately stay outside the gate.
// "/" only needs the stray-code forward; "/login" also skips ahead when already signed in.
export const config = {
  matcher: ["/teacher/:path*", "/classes/:path*", "/session/:path*", "/", "/login"],
};
