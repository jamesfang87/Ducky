"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo, User } from "@/components/ui/icons";
import { RoleToggle, type Role } from "@/components/ui/RoleToggle";

function LoginCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<Role>(params.get("role") === "teacher" ? "teacher" : "student");

  // TODO: replace with supabase.auth.signInWithOAuth({ provider: "google" }) and route by profile.role
  const signIn = () => router.push(role === "student" ? "/session/demo" : "/teacher");

  return (
    <div className="card rounded-2xl p-6">
      <p className="eyebrow mb-1.5">Welcome back</p>
      <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em]">Log in to Ducky</h1>
      <p className="mt-2 text-[15px] text-sub">
        Pick the side you’re on. Students land in their session; teachers land in the class dashboard.
      </p>

      <div className="mt-5">
        <p className="mb-2.5 text-sm font-semibold">I’m a…</p>
        <RoleToggle role={role} onChange={setRole} />
      </div>

      <button
        onClick={signIn}
        className="mt-3.5 flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl bg-ink font-semibold text-white transition hover:bg-sub"
      >
        <User /> Continue with Google
      </button>
      <p className="mt-3 text-[13px] text-muted">
        Use your school account. Your sessions belong to you, and student data is never used to train AI models.
      </p>
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
        <Suspense fallback={<div className="card h-[320px] rounded-2xl" />}>
          <LoginCard />
        </Suspense>
      </main>
    </div>
  );
}
