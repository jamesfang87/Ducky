"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginButton() {
  const next = useSearchParams().get("next") ?? "/";
  const signIn = async () => {
    await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  };
  return (
    <button onClick={signIn} className="rounded-lg bg-yellow-400 px-6 py-3 font-semibold text-black hover:bg-yellow-300">
      Sign in with Google
    </button>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-4xl font-bold">🦆 Ducky</h1>
      <p className="text-gray-500">Explain your reasoning. Ducky asks why.</p>
      <Suspense>
        <LoginButton />
      </Suspense>
    </main>
  );
}
