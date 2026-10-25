import Link from "next/link";
import { Send } from "@/components/ui/icons";
import type { ProblemSetRecord } from "@/lib/problemSets";

export function ProblemSetCard({ set }: { set: ProblemSetRecord }) {
  const pct = set.problems > 0 ? Math.round((set.completed / set.problems) * 100) : 0;
  const started = set.completed > 0;
  const done = set.completed >= set.problems;
  const status = done ? "Complete" : started ? "In progress" : "Not started";

  return (
    <Link
      href={`/session/${set.sessionId}`}
      className="card group flex flex-wrap items-center gap-4 p-4 text-ink no-underline transition hover:border-accent hover:shadow-sm sm:flex-nowrap"
    >
      <span
        className="flex h-12 w-12 flex-none flex-col items-center justify-center rounded-xl border border-line bg-ground"
        aria-hidden="true"
      >
        <span className="font-mono text-[15px] font-semibold leading-none">{set.number}</span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">PS</span>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-[16px] font-semibold leading-snug sm:text-[17px]">
            Problem Set {set.number} · {set.title}
          </h3>
          <span className={`chip ${done ? "border-accent/25 bg-accent-tint text-accent-dark" : ""}`}>{status}</span>
        </div>
        <p className="mt-0.5 text-[13.5px] text-sub">{set.summary}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-muted">
          <span className="h-1.5 w-32 overflow-hidden rounded-full bg-ground" aria-hidden="true">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </span>
          <span>
            {set.completed} of {set.problems} problems
          </span>
          {set.due && <span>Due {set.due}</span>}
          <span className="hidden sm:inline">Posted {set.posted}</span>
        </div>
      </div>

      <span className="btn-primary h-9 flex-none px-3 text-sm">
        {done ? "Review" : started ? "Continue" : "Start"} <Send size={13} />
      </span>
    </Link>
  );
}
