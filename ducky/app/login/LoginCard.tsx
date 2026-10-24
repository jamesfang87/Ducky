"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { User } from "@/components/ui/icons";
import { RoleToggle, type Role } from "@/components/ui/RoleToggle";
import { createClient } from "@/lib/supabase/client";

const MODES = ["login", "signup"] as const;
type Mode = (typeof MODES)[number];

export default function LoginCard() {
  const params = useSearchParams();
  const [role, setRole] = useState<Role>(params.get("role") === "teacher" ? "teacher" : "student");
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const isSignup = mode === "signup";

  // Real sign-in: Google through Supabase Auth. The chosen role is saved once, on first sign-in.
  // `select_account` makes Google ask which account to use, so a shared computer never signs in silently.
  const submit = async () => {
    setPending(true);
    setError(null);
    const next = params.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "";
    const redirectTo = `${window.location.origin}/auth/callback?role=${role}${safeNext ? `&next=${encodeURIComponent(safeNext)}` : ""}`;
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams: { prompt: "select_account" } },
      });
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Sign-in is not configured on this deployment yet.");
      setPending(false);
    } // on success the browser is already heading to Google
  };

  return (
    <div className="card rounded-2xl p-6">
      <div role="group" aria-label="Log in or create an account" className="mb-5 flex gap-5 border-b border-line">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
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

      <div className="mt-5">
        <p className="mb-2.5 text-sm font-semibold">I’m a…</p>
        <RoleToggle role={role} onChange={setRole} />
      </div>

      <button
        onClick={submit}
        disabled={pending}
        className="mt-3.5 flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl bg-ink font-semibold text-white transition hover:bg-sub disabled:opacity-60"
      >
        <User /> {pending ? "Opening Google…" : isSignup ? "Sign up with Google" : "Log in with Google"}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-sm text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
