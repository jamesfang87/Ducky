"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MISCONCEPTIONS, STUDENT_NAME } from "@/lib/mock";
import { useStore } from "@/lib/store";
import type { TranscriptRow } from "@/lib/types";
import Heatmap from "./Heatmap";
import { LeakAlert, TranscriptTable } from "./LeakAndTranscripts";
import PolicyPanel from "./PolicyPanel";
import TeacherShell from "./TeacherShell";

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
    <TeacherShell
      headerExtra={
        <>
          <label htmlFor="search" className="sr-only">
            Search students and transcripts
          </label>
          <input
            id="search"
            type="search"
            placeholder="Search students, transcripts…"
            className="h-10 min-w-0 flex-[0_1_280px] rounded-[10px] border border-edge bg-surface px-3.5 placeholder:text-muted"
          />
          <button onClick={resetDemo} className="btn h-10 text-sm" title="Clear live events and restore default policy">
            Reset demo
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-[1_1_300px]">
          <p className="text-sm text-muted">PHYS 1401 · Period 3</p>
          <h1 className="mt-0.5 font-display text-[30px] font-bold tracking-tight">Problem Set 3: Free fall</h1>
        </div>
        <Link href="/teacher" className="btn no-underline">
          Upload problem set
        </Link>
        <Link href="/teacher" className="btn-primary no-underline">
          Assign to class
        </Link>
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
            {3 + (liveRow ? 1 : 0)} flags
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
    </TeacherShell>
  );
}
