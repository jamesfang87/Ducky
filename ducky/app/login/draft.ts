/**
 * Half-finished sign-in, kept in localStorage so closing the tab (or switching to the email
 * app to confirm) doesn't lose what was typed. Never holds the password. Expires after a day.
 */
export interface LoginDraft {
  mode: "login" | "signup";
  role: "student" | "teacher";
  name: string;
  email: string;
  stay: boolean;
  next: string;
  /** Set once a confirmation or sign-in link went out; the card then shows "check your inbox". */
  awaiting: { email: string; kind: "confirm" | "link" } | null;
  savedAt: number;
}

const KEY = "ducky-login-draft";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function loadDraft(): Partial<LoginDraft> | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as LoginDraft;
    if (!draft.savedAt || Date.now() - draft.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<LoginDraft, "savedAt">) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // storage blocked (private window); the form still works, it just won't be restored
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
