import Link from "next/link";
import type { ClassRecord, ClassTone } from "@/lib/classes";
import { Send } from "@/components/ui/icons";

const DOT: Record<ClassTone, string> = {
  accent: "bg-accent",
  amber: "bg-warn",
  blue: "bg-[#2F6FEB]",
};

export function ClassCard({ record }: { record: ClassRecord }) {
  const pct = record.assignments > 0 ? Math.round((record.completed / record.assignments) * 100) : 0;

  return (
    <article className="card flex flex-col p-5">
      <div className="min-w-0">
        <p className="eyebrow flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 flex-none rounded-full ${DOT[record.tone]}`} aria-hidden="true" />
          {record.course} · {record.term}
        </p>
        <h2 className="mt-1 font-display text-[20px] font-semibold leading-snug">{record.name}</h2>
        <p className="mt-0.5 text-sm text-sub">{record.teacher}</p>
      </div>

      {record.assignments > 0 ? (
        <div className="mt-5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-sub">
              {record.completed} of {record.assignments} problems
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
          {record.nextDue && <p className="mt-2 text-[13px] text-muted">Next due {record.nextDue}</p>}
        </div>
      ) : (
        <p className="mt-5 text-[13px] text-muted">No assignments posted yet.</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span className="min-w-0 truncate text-[12.5px] text-muted">
          {record.activeAssignment?.label ?? "Nothing to do right now"}
        </span>
        {record.activeAssignment ? (
          <Link href={record.activeAssignment.href} className="btn-primary h-9 flex-none px-3 text-sm">
            Continue <Send size={13} />
          </Link>
        ) : (
          <span className="chip flex-none">No assignments</span>
        )}
      </div>
    </article>
  );
}
