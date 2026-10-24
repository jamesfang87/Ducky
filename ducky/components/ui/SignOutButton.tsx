"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Clears the session cookie and returns to the login screen. */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="text-sm text-sub transition hover:text-ink disabled:opacity-50"
    >
      Sign out
    </button>
  );
}
