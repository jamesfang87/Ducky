import type { CookieOptions } from "@supabase/ssr";

/**
 * "Stay signed in": the login page sets REMEMBER_COOKIE to the time (ms) the sign-in should
 * end, 30 days out. Auth cookies then live until that moment, even across browser restarts.
 * Without it they are session cookies, cleared when the browser closes.
 * Pure module: safe to import from middleware and the browser.
 */
export const REMEMBER_COOKIE = "ducky-remember";
export const REMEMBER_SECONDS = 60 * 60 * 24 * 30;

export const AUTH_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/** Seconds left on a "stay signed in" choice, or 0 if there is none or it ran out. */
export function rememberSecondsLeft(value: string | undefined): number {
  const until = Number(value);
  return Number.isFinite(until) ? Math.max(0, Math.floor((until - Date.now()) / 1000)) : 0;
}

/**
 * Sets each auth cookie's lifetime. @supabase/ssr writes every cookie with a 400-day maxAge,
 * whatever cookieOptions say, so this runs in each client's setAll instead.
 */
export function withLifetime(options: CookieOptions, remember: string | undefined): CookieOptions {
  if (options.maxAge === 0) return options; // a delete; leave it alone
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  const left = rememberSecondsLeft(remember);
  return left > 0 ? { ...rest, maxAge: left } : rest;
}
