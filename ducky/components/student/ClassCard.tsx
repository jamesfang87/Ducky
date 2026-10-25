import Link from "next/link";
import { getClassSummary, type ClassRecord, type ClassTone } from "@/lib/classes";
import { Send } from "@/components/ui/icons";

const DOT: Record<ClassTone, string> = {
  accent: "bg-accent",
  amber: "bg-warn",
  blue: "bg-[#2F6FEB]",
  violet: "bg-[#7C3AED]",
};

export function ClassCard({ record }: { record: ClassRecord }) {
  const { problems, completed, pct, due, activeSet } = getClassSummary(record);

  return (
    <article className="card relative flex flex-col p-5 transition hover:border-accent hover:shadow-sm">
      <div className="min-w-0">
        <p className="eyebrow flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 flex-none rounded-full ${DOT[record.tone]}`} aria-hidden="true" />
          {record.course} · {record.term}
        </p>
        <h2 className="mt-1 font-display text-[20px] font-semibold leading-snug">
          {/* Stretches over the card so the whole card opens the class. */}
          <Link
            href={`/classes/${record.id}`}
            className="text-ink no-underline after:absolute after:inset-0 after:rounded-[14px] after:content-[''] hover:text-accent-dark focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent focus-visible:after:ring-offset-2"
          >
            {record.name}
          </Link>
        </h2>
        <p className="mt-0.5 text-sm text-sub">{record.teacher}</p>
      </div>

      {problems > 0 ? (
        <div className="mt-5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-sub">
              {completed} of {problems} problems
            </span>
            <span className="font-mono text-muted">{pct}%</span>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ground"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${record.name} progress`}
          >
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          {due && <p className="mt-2 text-[13px] text-muted">Next due {due}</p>}
        </div>
      ) : (
        <p className="mt-5 text-[13px] text-muted">No assignments posted yet.</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span className="min-w-0 truncate text-[12.5px] text-muted">
          {activeSet
            ? `Problem Set ${activeSet.number} · ${activeSet.title}`
            : problems > 0
              ? "All caught up"
              : "Nothing to do right now"}
        </span>
        {problems > 0 ? (
          <span className="btn-primary h-9 flex-none px-3 text-sm">
            View problem sets <Send size={13} />
          </span>
        ) : (
          <span className="chip flex-none">No assignments</span>
        )}
      </div>
      <div className="pt-3">
        <Link href="/classes/history" className="relative z-10 text-[12.5px] text-sub no-underline hover:text-ink">
          Past problem sets →
        </Link>
      </div>
    </article>
  );
}
