import { band, BANDS } from "@/lib/insights";

/** A 0–100 score in its mastery color, or a dash when there's nothing to grade. */
export function Score({ score, sub, className = "" }: { score: number | null; sub?: string; className?: string }) {
  const b = band(score);
  return (
    <span title={b.label} className={`inline-flex min-w-[52px] flex-col items-center rounded-md px-2 py-1 font-mono text-[13px] font-medium ${b.className} ${className}`}>
      {score === null ? "—" : score}
      {sub && <span className="font-sans text-[11px] font-normal opacity-80">{sub}</span>}
    </span>
  );
}

export function BandLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      {BANDS.map((b) => (
        <span key={b.range} className="flex items-center gap-1.5">
          <span className={`h-3 w-5 rounded-[3px] ${b.className}`} aria-hidden="true" />
          {b.range}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded-[3px] border border-line bg-ground" aria-hidden="true" />
        Not started
      </span>
    </div>
  );
}

/** Explains empty pages when the tutor can't save attempts. */
export function RecordingNotice({ recording }: { recording: boolean }) {
  if (recording) return null;
  return (
    <p role="status" className="rounded-xl border border-warn-soft bg-warn-tint px-4 py-2.5 text-sm text-warn-dark">
      Student work isn’t being recorded: the server is missing <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>. Grades and timings appear once it’s set.
    </p>
  );
}
