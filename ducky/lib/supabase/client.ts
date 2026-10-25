import { createBrowserClient, type CookieOptions } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS, REMEMBER_COOKIE, REMEMBER_SECONDS, withLifetime } from "./cookies";

function readCookies(): { name: string; value: string }[] {
  return document.cookie
    .split("; ")
    .filter(Boolean)
    .map((c) => {
      const at = c.indexOf("=");
      return { name: c.slice(0, at), value: decodeURIComponent(c.slice(at + 1)) };
    });
}

function writeCookie(name: string, value: string, o: CookieOptions) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${o.path ?? "/"}; SameSite=${o.sameSite === true ? "Strict" : o.sameSite || "Lax"}`;
  if (o.maxAge !== undefined) c += `; Max-Age=${o.maxAge}`;
  if (o.domain) c += `; Domain=${o.domain}`;
  if (o.secure) c += "; Secure";
  document.cookie = c;
}

/** Called from the login page: remember this sign-in for 2 hours, or only until the browser closes. */
export function setStaySignedIn(stay: boolean) {
  if (stay) writeCookie(REMEMBER_COOKIE, String(Date.now() + REMEMBER_SECONDS * 1000), { ...AUTH_COOKIE_OPTIONS, maxAge: REMEMBER_SECONDS });
  else writeCookie(REMEMBER_COOKIE, "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
}

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => readCookies(),
      setAll: (toSet) => {
        const remember = readCookies().find((c) => c.name === REMEMBER_COOKIE)?.value;
        toSet.forEach(({ name, value, options }) => writeCookie(name, value, withLifetime(options, remember)));
      },
    },
  });
}
