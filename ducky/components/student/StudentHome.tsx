"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AccountChip } from "@/components/ui/AccountChip";
import { Logo, Plus } from "@/components/ui/icons";
import { useSession } from "@/lib/session";
import { useEnrolledClasses, type JoinResult } from "@/lib/useClasses";
import { ClassCard } from "./ClassCard";
import { JoinClassDialog } from "./JoinClassDialog";

export default function StudentHome() {
  const session = useSession();
  const { classes, join } = useEnrolledClasses();
  const [joining, setJoining] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openJoin = useCallback(() => setJoining(true), []);
  const closeJoin = useCallback(() => setJoining(false), []);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const handleJoin = (code: string): JoinResult => {
    const result = join(code);
    if (result.ok) {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      setNotice(`Joined ${result.record.course} · ${result.record.name}`);
      noticeTimer.current = setTimeout(() => setNotice(null), 4000);
    }
    return result;
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1120px] items-center gap-4 px-6 py-3.5">
          <Logo />
          <div className="flex-1" />
          <AccountChip />
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-6 pb-16 pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{session?.name ?? "Student"} · Fall 2026</p>
            <h1 className="mt-1 font-display text-[32px] font-bold tracking-[-0.02em] md:text-[38px]">Your classes</h1>
            <p className="mt-1.5 text-sub">
              Pick up where you left off, or join a class with a code from your teacher.
            </p>
          </div>
          <button type="button" onClick={openJoin} className="btn-primary">
            <Plus /> Join a class
          </button>
        </div>

        {notice && (
          <p
            role="status"
            className="mt-6 rounded-xl border border-accent/25 bg-accent-tint px-4 py-2.5 text-sm text-accent-dark"
          >
            {notice}
          </p>
        )}

        {classes.length > 0 ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {classes.map((record) => (
              <ClassCard key={record.id} record={record} />
            ))}
            <button
              type="button"
              onClick={openJoin}
              className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-edge p-5 text-center transition hover:border-accent hover:bg-white"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-accent shadow-sm">
                <Plus />
              </span>
              <span className="font-display text-[15px] font-semibold">Join a class</span>
              <span className="text-[12.5px] text-muted">Enter the code from your teacher</span>
            </button>
          </div>
        ) : (
          <div className="card mt-8 flex flex-col items-center gap-3 p-10 text-center">
            <p className="font-display text-lg font-semibold">No classes yet</p>
            <p className="max-w-[380px] text-sm text-sub">
              Ask your teacher for the 6-character class code, then join here.
            </p>
            <button type="button" onClick={openJoin} className="btn-primary mt-1">
              Join a class
            </button>
          </div>
        )}
      </main>

      {joining && <JoinClassDialog onClose={closeJoin} join={handleJoin} />}
    </div>
  );
}
