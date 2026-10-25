/**
 * How often the authenticator-app code is asked for. Pure module: safe in middleware, server and browser.
 *
 * Signing in stays valid for weeks (see AUTH_COOKIE_MAX_AGE), but the second step is only
 * trusted for a few hours. After that the next page load shows the 6-digit code screen once,
 * and then it is quiet again for another window.
 */
export const MFA_WINDOW_MS = 3 * 60 * 60 * 1000;

type Aal = {
  currentLevel?: string | null;
  currentAuthenticationMethods?: (string | { method: string; timestamp: number })[] | null;
} | null;

/** True only if this session passed the authenticator check (aal2) within the last window. Fails closed. */
export function mfaIsFresh(aal: Aal, now: number = Date.now()): boolean {
  if (aal?.currentLevel !== "aal2") return false;
  const stamps = (aal.currentAuthenticationMethods ?? [])
    .flatMap((m) => (typeof m === "object" && m.method === "totp" ? [m.timestamp * 1000] : [])); // Supabase reports seconds
  if (stamps.length === 0) return false;
  return now - Math.max(...stamps) < MFA_WINDOW_MS;
}
