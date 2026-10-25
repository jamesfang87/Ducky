/**
 * Auth cookies last 2 hours, so a returning visitor stays signed in for that long.
 * Supabase rewrites them whenever it refreshes the session, so the 2 hours restart
 * on each visit. Pure module: safe to import from middleware and the browser.
 */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 2;

export const AUTH_COOKIE_OPTIONS = {
  maxAge: AUTH_COOKIE_MAX_AGE,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
