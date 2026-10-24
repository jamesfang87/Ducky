"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { User } from "@/components/ui/icons";
import { RoleToggle, type Role } from "@/components/ui/RoleToggle";

const MODES = ["login", "signup"] as const;
type Mode = (typeof MODES)[number];

export default function LoginCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<Role>(params.get("role") === "teacher" ? "teacher" : "student");
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSignup = mode === "signup";

  // Mock sign-in: sets the session cookie server-side, then follows the role's home.
  // Replace with supabase.auth.signInWithOAuth({ provider: "google" }) when auth is real.
  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = (await res.json()) as { redirect?: string; error?: string };
      if (!res.ok || !data.redirect) throw new Error(data.error ?? "Could not sign you in.");

      // Only follow same-site paths from ?next=, never an absolute URL.
      const next = params.get("next");
      const target = next && next.startsWith("/") && !next.startsWith("//") ? next : data.redirect;
      router.push(target);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign you in.");
    } finally {
      setPending(false);
    }
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
        <User /> {pending ? "Signing in…" : isSignup ? "Sign up with Google" : "Log in with Google"}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-sm text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
