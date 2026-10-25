import Link from "next/link";
import { ThemePicker } from "@/components/ui/ThemePicker";
import { Suspense } from "react";
import { Logo } from "@/components/ui/icons";
import { Benefits } from "./Benefits";
import LoginCard from "./LoginCard";

export const metadata = { title: "Log in · Ducky" };

export default function Login() {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(55% 45% at 88% 8%, rgb(var(--accent-glow) / 0.3), transparent 70%), radial-gradient(45% 40% at 4% 96%, rgb(var(--accent) / 0.14), transparent 70%)" }}
      />
      <header className="mx-auto flex w-full max-w-[1080px] items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-4">
          <ThemePicker />
          <Link href="/" className="text-sub no-underline hover:text-ink">
            Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-[1080px] flex-1 items-start gap-12 px-6 pb-16 pt-4 md:pt-10 lg:grid-cols-[1fr_440px]">
        <Benefits />
        <Suspense fallback={<div className="card h-[360px] rounded-2xl" />}>
          <LoginCard />
        </Suspense>
      </main>
    </div>
  );
}
