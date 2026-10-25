"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { User } from "@/components/ui/icons";
import { RoleToggle, type Role } from "@/components/ui/RoleToggle";
import { createClient, setStaySignedIn } from "@/lib/supabase/client";
import { homePath } from "@/lib/users";
import { clearDraft, loadDraft, saveDraft, type LoginDraft } from "./draft";

const MODES = ["login", "signup"] as const;
type Mode = (typeof MODES)[number];

/** Someone who already got past the first step but stopped before finishing (no role yet, or no 2-step code). */
interface Resume {
  email: string;
  role: Role | null;
}

const safePath = (p: string | null | undefined) => (p && p.startsWith("/") && !p.startsWith("//") ? p : "");

const inputClass = "h-[46px] w-full rounded-xl border border-line bg-surface px-4 text-[15px] outline-none focus:border-accent";

export default function LoginCard() {
  const params = useSearchParams();
  const [role, setRole] = useState<Role>(params.get("role") === "teacher" ? "teacher" : "student");
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stay, setStay] = useState(true);
  const [next, setNext] = useState(safePath(params.get("next")));
  const [awaiting, setAwaiting] = useState<LoginDraft["awaiting"]>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [restored, setRestored] = useState(false);
  const [pending, setPending] = useState<"google" | "email" | "link" | "resend" | "resume" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(params.get("error"));
  const isSignup = mode === "signup";

  // Restore a half-filled form from last time. URL params (a fresh link) win over the saved draft.
  useEffect(() => {
    const d = loadDraft();
    if (d) {
      if (!params.get("mode") && d.mode) setMode(d.mode);
      if (!params.get("role") && d.role) setRole(d.role);
      if (!params.get("next") && d.next) setNext(safePath(d.next));
      setName(d.name ?? "");
      setEmail(d.email ?? "");
      setStay(d.stay ?? true);
      setAwaiting(d.awaiting ?? null);
    }
    setRestored(true);
  }, [params]);

  useEffect(() => {
    if (restored) saveDraft({ mode, role, name, email, stay, next, awaiting });
  }, [restored, mode, role, name, email, stay, next, awaiting]);

  // The role only travels when creating an account. Logging in never picks or changes it.
  const callbackUrl = (r?: Role) => {
    const q = [r ? `role=${r}` : "", next ? `next=${encodeURIComponent(next)}` : ""].filter(Boolean).join("&");
    return `${window.location.origin}/auth/callback${q ? `?${q}` : ""}`;
  };

  /** Already signed in but not finished? Offer to pick up where they left off instead of starting over. */
  const checkSignedIn = useCallback(async (): Promise<boolean> => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      const r = profile?.role;
      setAwaiting(null);
      setResume({ email: user.email ?? "your account", role: r === "student" || r === "teacher" ? r : null });
      return true;
    } catch {
      return false; // not configured; the form shows the error when they try to sign in
    }
  }, []);

  useEffect(() => {
    void checkSignedIn();
  }, [checkSignedIn]);

  // While waiting on an email link, coming back to this tab re-checks: the link may have been opened in another tab.
  useEffect(() => {
    if (!awaiting) return;
    const onFocus = () => void checkSignedIn();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [awaiting, checkSignedIn]);

  /** Lock in the role (first sign-in only), then head on. The middleware sends them through /mfa first. */
  const finish = async (fallbackRole: Role | null) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Signed in, but no session was saved. Check that cookies are allowed.");
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    let r = profile?.role as Role | null | undefined;
    const isNew = !r;
    if (!r) {
      // An account with no role yet (first Google sign-in, say): ask once, here, instead of guessing.
      if (!fallbackRole) {
        setAwaiting(null);
        setResume({ email: user.email ?? "your account", role: null });
        setPending(null);
        return;
      }
      const { error: roleError } = await supabase.rpc("set_my_role", { new_role: fallbackRole });
      if (roleError) throw new Error(`Could not save your role: ${roleError.message}`);
      r = fallbackRole;
    }
    if (r !== "student" && r !== "teacher") throw new Error("This account has no student or teacher access.");
    clearDraft();
    // A brand-new account starts on its own home, not a leftover `next` (a new teacher would land on the student side).
    window.location.assign((!isNew && next) || homePath(r));
  };

  const run = async (kind: NonNullable<typeof pending>, fn: () => Promise<void>) => {
    setPending(kind);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Sign-in is not configured on this deployment yet.");
      setPending(null);
    }
  };

  // Google through Supabase Auth. `select_account` makes Google ask which account to use, so a shared computer never signs in silently.
  const google = () =>
    run("google", async () => {
      setStaySignedIn(stay); // read when the callback saves the session
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl(isSignup ? role : undefined), queryParams: { prompt: "select_account" } },
      });
      if (error) throw error;
    }); // on success the browser is already heading to Google

  const emailSubmit = () =>
    run("email", async () => {
      setStaySignedIn(stay);
      const supabase = createClient();
      const addr = email.trim();
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: addr,
          password,
          // role rides along in metadata so the callback can still set it if the link loses its ?role
          options: { emailRedirectTo: callbackUrl(role), data: { full_name: name.trim() || undefined, role } },
        });
        if (error) throw error;
        // Supabase hides "already registered" behind a user with no identities.
        if (data.user && data.user.identities?.length === 0) {
          setMode("login");
          throw new Error("That email already has an account. Log in instead.");
        }
        if (data.session) return finish(role); // email confirmation is turned off
        setPassword("");
        setAwaiting({ email: addr, kind: "confirm" });
        setPending(null);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: addr, password });
      if (error) {
        if (error.code === "email_not_confirmed") {
          setAwaiting({ email: addr, kind: "confirm" });
          setPending(null);
          return;
        }
        throw new Error(error.code === "invalid_credentials" ? "Wrong email or password." : error.message);
      }
      setPassword("");
      await finish(null);
    });

  /** Passwordless: one-time sign-in link. Doubles as "forgot password". */
  const sendLink = (addr = email.trim()) =>
    run("link", async () => {
      if (!addr) throw new Error("Enter your email first.");
      setStaySignedIn(stay);
      const { error } = await createClient().auth.signInWithOtp({
        email: addr,
        options: {
          emailRedirectTo: callbackUrl(isSignup ? role : undefined),
          shouldCreateUser: isSignup,
          ...(isSignup ? { data: { full_name: name.trim() || undefined, role } } : {}),
        },
      });
      if (error) throw new Error(error.code === "otp_disabled" || error.status === 422 ? "No account with that email yet. Create one first." : error.message);
      setAwaiting({ email: addr, kind: "link" });
      setPending(null);
    });

  const resend = () =>
    run("resend", async () => {
      if (!awaiting) return;
      const supabase = createClient();
      const { error } =
        awaiting.kind === "confirm"
          ? await supabase.auth.resend({ type: "signup", email: awaiting.email, options: { emailRedirectTo: callbackUrl(isSignup ? role : undefined) } })
          : await supabase.auth.signInWithOtp({ email: awaiting.email, options: { emailRedirectTo: callbackUrl(isSignup ? role : undefined), shouldCreateUser: false } });
      if (error) throw error;
      setNotice("Sent again. It can take a minute; check spam too.");
      setPending(null);
    });

  const startOver = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearDraft();
    setResume(null);
    setAwaiting(null);
    setName("");
    setEmail("");
    setPassword("");
    setError(null);
    setNotice(null);
  };

  if (resume) {
    return (
      <div className="card rounded-2xl p-6">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em]">Pick up where you left off</h1>
        <p className="mt-2 text-sm text-sub">
          You’re signed in as <span className="font-semibold text-ink">{resume.email}</span>
          {resume.role ? " but didn’t finish setting up." : ". One last thing before you start."}
        </p>
        {!resume.role && (
          <div className="mt-5">
            <p className="mb-2.5 text-sm font-semibold">I’m a…</p>
            <RoleToggle role={role} onChange={setRole} />
            <p className="mt-2 text-[13px] text-muted">Pick what you’ll mostly be. Teachers can also join classes as a student. This can’t be changed later.</p>
          </div>
        )}
        <button
          onClick={() => run("resume", () => finish(resume.role ?? role))}
          disabled={!!pending}
          className="mt-4 flex h-[50px] w-full items-center justify-center rounded-xl bg-ink font-semibold text-ground transition hover:bg-sub disabled:opacity-60"
        >
          {pending === "resume" ? "Continuing…" : "Continue"}
        </button>
        <button type="button" onClick={startOver} className="mt-4 text-sm text-sub transition hover:text-ink">
          Use a different account
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-warn">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (awaiting) {
    return (
      <div className="card rounded-2xl p-6">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em]">Check your inbox</h1>
        <p className="mt-2 text-sm text-sub">
          We sent a {awaiting.kind === "confirm" ? "confirmation" : "sign-in"} link to{" "}
          <span className="font-semibold text-ink">{awaiting.email}</span>. Open it in this browser to{" "}
          {awaiting.kind === "confirm" ? "finish creating your account" : "sign in"}. You can close this tab; we’ll remember where you were.
        </p>
        <button
          onClick={() =>
            run("resume", async () => {
              if (!(await checkSignedIn())) throw new Error("Not signed in yet. Open the link from the email in this browser, then try again.");
              setPending(null);
            })
          }
          disabled={!!pending}
          className="mt-5 flex h-[50px] w-full items-center justify-center rounded-xl bg-ink font-semibold text-ground transition hover:bg-sub disabled:opacity-60"
        >
          {pending === "resume" ? "Checking…" : "I opened the link"}
        </button>
        <div className="mt-4 flex justify-between text-sm">
          <button type="button" onClick={resend} disabled={!!pending} className="text-sub transition hover:text-ink disabled:opacity-60">
            {pending === "resend" ? "Sending…" : "Resend email"}
          </button>
          <button type="button" onClick={() => setAwaiting(null)} className="text-sub transition hover:text-ink">
            Use a different email
          </button>
        </div>
        {notice && <p className="mt-3 text-sm text-sub">{notice}</p>}
        {error && (
          <p role="alert" className="mt-3 text-sm text-warn">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="card rounded-2xl p-6">
      <div role="group" aria-label="Log in or create an account" className="mb-5 flex gap-5 border-b border-line">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`-mb-px border-b-2 pb-2 text-[15px] transition ${
              mode === m ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {m === "login" ? "Log in" : "Create account"}
          </button>
        ))}
      </div>

      <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em]">
        {isSignup ? "Create your account" : "Log in to Ducky"}
      </h1>

      {isSignup && (
        <div className="mt-5">
          <p className="mb-2.5 text-sm font-semibold">I’m a…</p>
          <RoleToggle role={role} onChange={setRole} />
          <p className="mt-2 text-[13px] text-muted">Pick what you’ll mostly be. Teachers can also join classes as a student. This can’t be changed later.</p>
        </div>
      )}

      <button
        onClick={google}
        disabled={!!pending}
        className="mt-3.5 flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl bg-ink font-semibold text-ground transition hover:bg-sub disabled:opacity-60"
      >
        <User /> {pending === "google" ? "Opening Google…" : isSignup ? "Sign up with Google" : "Log in with Google"}
      </button>

      <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
      </div>

      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void emailSubmit();
        }}
      >
        {isSignup && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            aria-label="Your name"
            autoComplete="name"
            className={inputClass}
          />
        )}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.edu"
          aria-label="Email"
          autoComplete="email"
          className={inputClass}
        />
        <input
          type="password"
          required
          minLength={isSignup ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isSignup ? "Password (8+ characters)" : "Password"}
          aria-label="Password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={!!pending}
          className="flex h-[50px] w-full items-center justify-center rounded-xl border border-ink font-semibold text-ink transition hover:bg-ground disabled:opacity-60"
        >
          {pending === "email" ? (isSignup ? "Creating account…" : "Logging in…") : isSignup ? "Create account" : "Log in with email"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => void sendLink()}
        disabled={!!pending}
        className="mt-2.5 text-sm text-sub transition hover:text-ink disabled:opacity-60"
      >
        {pending === "link" ? "Sending link…" : isSignup ? "Rather not pick a password? Email me a sign-up link" : "Forgot your password? Email me a sign-in link"}
      </button>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
        <input type="checkbox" checked={stay} onChange={(e) => setStay(e.target.checked)} className="mt-0.5 h-4 w-4 accent-accent" />
        <span>
          Stay signed in on this device (security code every 3 hours)
          <span className="block text-[13px] text-muted">Skip signing in again when you come back. Leave unchecked on a shared computer.</span>
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-3 text-sm text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
