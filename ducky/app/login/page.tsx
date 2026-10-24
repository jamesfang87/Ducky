"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo, User } from "@/components/ui/icons";
import { RoleToggle, type Role } from "@/components/ui/RoleToggle";
import { createClient } from "@/lib/supabase/client";

const MODES = ["login", "signup"] as const;
type Mode = (typeof MODES)[number];

function LoginCard() {
  const params = useSearchParams();
  const [role, setRole] = useState<Role>(params.get("role") === "teacher" ? "teacher" : "student");
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const isSignup = mode === "signup";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get("error") ?? "");

  const submit = async () => {
    setBusy(true);
    setError("");
    const next = params.get("next") ?? "";
    const redirectTo =
      `${window.location.origin}/auth/callback?role=${role}` + (next ? `&next=${encodeURIComponent(next)}` : "");
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) {
      setError(error.message);
      setBusy(false);
    } // on success the browser is already navigating to Google
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

      {error && (
        <p role="alert" className="mt-3.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={busy}
        className="mt-3.5 flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl bg-ink font-semibold text-white transition hover:bg-sub"
      >
        <User /> {busy ? "Opening Google…" : isSignup ? "Sign up with Google" : "Log in with Google"}
      </button>
    </div>
  );
}

export default function Login() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-[440px] items-center justify-between px-6 py-5">
        <Logo />
        <Link href="/" className="text-sub no-underline hover:text-ink">
          Back to home
        </Link>
      </header>
      <main className="mx-auto w-full max-w-[440px] flex-1 px-6 pb-16 pt-4">
        <Suspense fallback={<div className="card h-[360px] rounded-2xl" />}>
          <LoginCard />
        </Suspense>
      </main>
    </div>
  );
}
