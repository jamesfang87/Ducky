/**
 * Two-step sign-in is optional. Nobody is sent to the code screen unless they turned it on for their
 * account; once they have, the code is asked for at sign-in (not on a timer) and the session stays
 * verified until they sign out. Pure module: safe in middleware, server and browser.
 */
type Aal = {
  currentLevel?: string | null;
  nextLevel?: string | null;
} | null;

/**
 * True when this session may proceed: either the account has no verified authenticator (nothing to check),
 * or this session already passed the code (aal2). Fails closed if Supabase gave no answer.
 */
export function mfaSatisfied(aal: Aal): boolean {
  if (!aal?.currentLevel) return false;
  return aal.currentLevel === "aal2" || aal.nextLevel !== "aal2";
}
