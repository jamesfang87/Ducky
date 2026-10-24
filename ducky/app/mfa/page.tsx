import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/icons";
import MfaCard from "./MfaCard";

export default function MfaPage() {
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
          <MfaCard />
        </Suspense>
      </main>
    </div>
  );
}
