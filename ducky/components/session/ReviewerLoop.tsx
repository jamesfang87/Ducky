import type { PipelineEvent } from "@/lib/types";
import { Spinner } from "@/components/ui/icons";

export default function ReviewerLoop({ events }: { events: PipelineEvent[] }) {
  return (
    <div className="rounded-[14px] bg-night px-5 py-[18px] text-[#E8EAE6]">
      <div className="mb-3 flex items-center gap-2.5">
        <h2 className="font-display text-base font-semibold text-white">Reviewer loop</h2>
        <span className="text-xs text-[#A9B0B8]">generate → render → review</span>
      </div>
      {events.length === 0 ? (
        <p className="font-mono text-[13px] text-[#A9B0B8]">Waiting for a visualization request…</p>
      ) : (
        <ol className="flex flex-col gap-2 font-mono text-[13px]" aria-live="polite">
          {events.map((e, i) => (
            <li key={i} className="flex animate-fadein gap-2.5">
              <span className="w-3 flex-none">
                {e.status === "running" ? (
                  <Spinner className="mt-1 text-[#A9B0B8]" />
                ) : e.status === "pass" ? (
                  <span className="text-accent-glow">✓</span>
                ) : (
                  <span className="text-[#F2B36B]">✕</span>
                )}
              </span>
              <span className={e.status === "running" ? "text-[#A9B0B8]" : ""}>{e.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
