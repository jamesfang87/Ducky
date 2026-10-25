"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountChip } from "@/components/ui/AccountChip";
import { Logo } from "@/components/ui/icons";
import { listPastSets, type PastSet } from "@/lib/history";
import { useSession } from "@/lib/session";

function when(iso: string | null): string {
  if (!iso) return "Saved on this device";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function HistoryView() {
  const session = useSession();
  const userId = session?.userId;
  const [sets, setSets] = useState<PastSet[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    listPastSets(userId)
      .then((s) => live && setSets(s))
      .catch(() => live && setSets([]));
    return () => {
      live = false;
    };
  }, [userId]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1120px] items-center gap-4 px-6 py-3.5">
          <Logo />
          <div className="flex-1" />
          <Link href="/classes" className="text-sm text-sub no-underline transition hover:text-ink">
            My classes
          </Link>
          <AccountChip />
        </div>
      </header>
      <main className="mx-auto max-w-[860px] px-6 pb-16 pt-10">
        <p className="eyebrow">Saved to your account</p>
        <h1 className="mt-1 font-display text-[32px] font-bold tracking-[-0.02em] md:text-[38px]">Past problem sets</h1>
        <p className="mt-1.5 text-sub">Reopen any problem set to read the conversation or keep going where you stopped.</p>

        {sets === null ? (
          <p className="mt-8 text-sm text-muted">Loading your history…</p>
        ) : sets.length === 0 ? (
          <div className="card mt-8 p-10 text-center">
            <p className="font-display text-lg font-semibold">Nothing here yet</p>
            <p className="mt-1 text-sm text-sub">Start a problem set and your conversation will be saved automatically.</p>
            <Link href="/classes" className="btn-primary mt-4 inline-flex">
              Go to my classes
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-3">
            {sets.map((s) => (
              <li key={s.sessionId}>
                <Link href={s.href} className="card block p-5 no-underline transition hover:border-accent">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-[18px] font-semibold text-ink">{s.title}</h2>
                    <span className="text-[12.5px] text-muted">{when(s.updatedAt)}</span>
                  </div>
                  {s.course && <p className="mt-0.5 text-[13px] text-sub">{s.course}</p>}
                  {s.preview && <p className="mt-2 truncate text-sm text-sub">“{s.preview}”</p>}
                  <p className="mt-2 text-[12.5px] text-muted">
                    {s.studentTurns} of your messages · {s.messageCount} total · Reopen →
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
