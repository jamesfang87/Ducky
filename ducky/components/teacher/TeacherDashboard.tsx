"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MISCONCEPTIONS, STUDENT_NAME } from "@/lib/mock";
import { useStore } from "@/lib/store";
import type { TranscriptRow } from "@/lib/types";
import { AccountChip } from "@/components/ui/AccountChip";
import { Logo } from "@/components/ui/icons";
import Heatmap from "./Heatmap";
import { LeakAlert, TranscriptTable } from "./LeakAndTranscripts";
import PolicyPanel from "./PolicyPanel";

const NAV = ["Class overview", "Tutor agents", "Assignments", "Transcripts", "Mastery reports", "Audit log"];

export default function TeacherDashboard() {
  const { events, resetDemo } = useStore();

  const liveRow: TranscriptRow | undefined = useMemo(() => {
    const mine = events.filter((e) => e.student === STUDENT_NAME);
    if (!mine.length) return undefined;
    const last = mine[mine.length - 1];
    const label = MISCONCEPTIONS.find((m) => m.id === last.misconception)?.label ?? "Misconception";
    const d = new Date(last.at);
    return {
      id: "live",
      student: STUDENT_NAME,
      flag: { kind: "warn", label: `Misconception: ${label.toLowerCase()}` },
      at: `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`,
      aiScore: 0,
      override: null,
    };
  }, [events]);

  const stats = [
    { label: "Sessions complete", value: "28", sub: "/ 31" },
    { label: "Avg. mastery", value: "74%" },
    { label: "Self-corrections", value: "41" },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-4 px-6 py-3.5">
          <Logo badge="for Schools" />
          <div className="flex-1" />
          <label htmlFor="search" className="sr-only">
            Search students and transcripts
          </label>
          <input
            id="search"
            type="search"
            placeholder="Search students, transcripts…"
            className="h-10 min-w-0 flex-[0_1_280px] rounded-[10px] border border-edge bg-white px-3.5 placeholder:text-muted"
          />
          <button onClick={resetDemo} className="btn h-10 text-sm" title="Clear live events and restore default policy">
            Reset demo
          </button>
          <AccountChip />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1360px] flex-wrap items-start gap-6 p-6">
        <nav aria-label="Teacher" className="flex max-w-[240px] flex-[1_1_200px] flex-col gap-1">
          {NAV.map((n, i) => (
            <a
              key={n}
              href="#"
              aria-current={i === 0 ? "page" : undefined}
              className={`rounded-[10px] px-3 py-2.5 no-underline ${i === 0 ? "border border-line bg-white font-semibold text-ink" : "text-sub hover:bg-white"}`}
            >
              {n}
            </a>
          ))}
          <Link href="/session/demo" className="mt-2 rounded-[10px] px-3 py-2.5 text-accent no-underline hover:bg-white">
            Preview as student →
          </Link>
          <div className="mt-4 rounded-[10px] bg-accent-tint p-3 text-[13px] text-accent-dark">
            Student data is never used to train models. Row-level security: you see only your classes.
          </div>
        </nav>

        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-[1_1_300px]">
              <p className="text-sm text-muted">PHYS 1401 · Period 3</p>
              <h1 className="mt-0.5 font-display text-[30px] font-bold tracking-tight">Problem Set 3: Free fall</h1>
            </div>
            <button className="btn">Upload problem set</button>
            <button className="btn-primary">Assign to class</button>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
            {stats.map((s) => (
              <div key={s.label} className="card p-4">
                <p className="text-[13px] text-muted">{s.label}</p>
                <p className="mt-1 font-display text-[28px] font-semibold">
                  {s.value} {s.sub && <span className="text-base text-muted">{s.sub}</span>}
                </p>
              </div>
            ))}
            <div className="rounded-[14px] border border-warn-soft bg-warn-tint p-4">
              <p className="text-[13px] text-warn-dark">Needs review</p>
              <p className="mt-1 font-display text-[28px] font-semibold text-warn-dark">
                {3 + (liveRow ? 1 : 0)} flags · 1 leak
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-5">
            <Heatmap events={events} />
            <PolicyPanel />
          </div>

          <div className="flex flex-wrap items-start gap-5">
            <LeakAlert />
            <TranscriptTable liveRow={liveRow} />
          </div>
        </main>
      </div>
    </div>
  );
}
