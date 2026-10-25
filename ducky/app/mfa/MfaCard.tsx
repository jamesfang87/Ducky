"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { clearDraft } from "@/app/login/draft";
import { createClient } from "@/lib/supabase/client";

type Stage = "loading" | "enroll" | "challenge";

/**
 * Second sign-in step (authenticator app code). Google proves who you are; this proves it is
 * really you holding your device. First time: scan the QR code. After that: type the 6-digit code.
 */
export default function MfaCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [stage, setStage] = useState<Stage>("loading");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");
      clearDraft(); // first step done; the login page shouldn't offer to restore it

      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) return setError(listError.message);

      const verified = factors?.totp.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        return setStage("challenge");
      }
      // Drop half-finished enrollments so retries start clean.
      for (const f of factors?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Ducky" });
      if (enrollError || !data) return setError(enrollError?.message ?? "Could not start two-step setup.");
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStage("enroll");
    })();
  }, [router]);

  const verify = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError(challengeError?.message ?? "Could not start the check.");
      return setBusy(false);
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() });
    if (verifyError) {
      setError("That code didn't work. Check the 6 digits and try again.");
      return setBusy(false);
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="card rounded-2xl p-6">
      <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em]">
        {stage === "enroll" ? "Set up two-step sign-in" : "Quick security check"}
      </h1>

      {stage === "loading" && !error && <p className="mt-4 text-sub">Loading…</p>}

      {stage === "challenge" && (
        <p className="mt-3 text-sm text-sub">
          You turned on two-step sign-in, so enter the 6-digit code from your authenticator app. You stay verified until you sign out.
        </p>
      )}

      {stage === "enroll" && (
        <div className="mt-4 text-sm text-sub">
          <p>
            Two-step sign-in is optional. If you turn it on, signing in will also ask for a code from an authenticator app (Google Authenticator,
            1Password, Authy). Scan this, then enter the code it shows.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code for your authenticator app" className="mx-auto my-4 h-44 w-44 rounded-lg bg-surface p-2" />
          <p className="break-all text-center font-mono text-xs">Can’t scan? Enter this key: {secret}</p>
        </div>
      )}

      {(stage === "enroll" || stage === "challenge") && (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            aria-label="6-digit code"
            className="h-[50px] w-full rounded-xl border border-line bg-surface px-4 text-center font-mono text-xl tracking-[0.3em]"
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="mt-3.5 flex h-[50px] w-full items-center justify-center rounded-xl bg-ink font-semibold text-ground transition hover:bg-sub disabled:opacity-60"
          >
            {busy ? "Checking…" : stage === "enroll" ? "Turn on and continue" : "Continue"}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-warn">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-5 text-sm">
        {stage === "enroll" && (
          <button type="button" onClick={() => router.replace("/")} className="text-sub transition hover:text-ink">
            Not now
          </button>
        )}
        <button type="button" onClick={signOut} className="text-sub transition hover:text-ink">
          Sign out
        </button>
      </div>
    </div>
  );
}
