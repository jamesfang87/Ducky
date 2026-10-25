"use client";

import { useState } from "react";
import { sendJson } from "./dialog";
import { PROBLEM, TRANSCRIPTS } from "@/lib/mock";
import type { LeakHit, TranscriptRow } from "@/lib/types";
import { Search, Spinner } from "@/components/ui/icons";

/** Live SerpApi check of the demo problem (POST /api/teacher/leaks). */
export function LeakAlert() {
  const [result, setResult] = useState<{ status: "clean" | "leaked"; hits: LeakHit[]; checkedAt: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const leaked = result?.status === "leaked" && !dismissed;

  const run = async () => {
    setChecking(true);
    setError(null);
    setDismissed(false);
    try {
      setResult(await sendJson<{ status: "clean" | "leaked"; hits: LeakHit[]; checkedAt: string }>("/api/teacher/leaks", "POST", { prompt: PROBLEM.prompt }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The leak check failed.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <section aria-label="Answer leak alert" className={`card min-w-0 flex-[2_1_320px] p-5 ${leaked ? "border-warn-soft" : ""}`}>
      <div className="mb-1 flex items-center gap-2.5">
        <Search className={leaked ? "text-warn" : "text-muted"} />
        <h2 className="font-display text-lg font-semibold">{leaked ? `Answer leak: Problem ${PROBLEM.index}` : "Answer leak check"}</h2>
      </div>
      <p className="mb-3.5 text-[13px] text-muted">
        SerpApi web search ·{" "}
        {result ? `checked ${new Date(result.checkedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "not checked yet"}
      </p>

      {dismissed ? (
        <p className="text-sm text-muted">Dismissed.</p>
      ) : result && !leaked ? (
        <p className="text-sm text-sub">No copies of this problem found online.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {result?.hits.map((h) => (
            <li key={h.url} className="flex items-center gap-3 rounded-[10px] bg-ground px-3 py-2.5">
              <a href={h.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 no-underline">
                <span className="block font-semibold">{h.domain}</span>
                <span className="block truncate text-[13px] text-muted">{h.title}</span>
              </a>
              <span className="font-mono text-[13px] font-medium text-warn">{h.match}% match</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-warn-dark">
          {error}
        </p>
      )}
      <div className="mt-3.5 flex flex-wrap gap-2">
        {leaked && <button className="btn-dark">Suggest a rewrite</button>}
        <button className="btn h-10" onClick={run} disabled={checking}>
          {checking ? (
            <>
              <Spinner /> Searching…
            </>
          ) : result ? (
            "Re-check now"
          ) : (
            "Check for leaks"
          )}
        </button>
        {leaked && (
          <button className="btn h-10" onClick={() => setDismissed(true)}>
            Dismiss
          </button>
        )}
      </div>
    </section>
  );
}

export function TranscriptTable({ liveRow }: { liveRow?: TranscriptRow }) {
  const [rows, setRows] = useState<TranscriptRow[]>(TRANSCRIPTS);
  const all = liveRow ? [liveRow, ...rows] : rows;

  const setOverride = (id: string, v: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, override: v === "" ? null : Math.max(0, Math.min(100, Number(v))) } : r)));

  return (
    <section aria-label="Transcripts and rubric scores" className="card min-w-0 flex-[3_1_480px] p-5">
      <div className="mb-3.5 flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-lg font-semibold">Transcripts &amp; rubric scores</h2>
        <span className="text-[13px] text-muted">AI score · you can override</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.06em] text-muted">
              <th className="pb-2.5 pr-2 font-semibold">Student</th>
              <th className="px-2 pb-2.5 font-semibold">Flagged moment</th>
              <th className="px-2 pb-2.5 font-semibold">AI score</th>
              <th className="pb-2.5 pl-2 font-semibold">Override</th>
            </tr>
          </thead>
          <tbody>
            {all.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-3 pr-2 font-semibold">
                  {r.student}
                  {r.id === "live" && <span className="ml-2 rounded bg-accent-tint px-1.5 py-0.5 text-[11px] font-semibold text-accent-dark">LIVE</span>}
                </td>
                <td className="px-2 py-3">
                  <span className={`rounded-md px-2 py-0.5 text-[13px] ${r.flag.kind === "good" ? "bg-accent-tint text-accent-dark" : "bg-warn-tint text-warn-dark"}`}>
                    {r.flag.label}
                  </span>{" "}
                  <a href="#" className="text-accent">
                    {r.at}
                  </a>
                </td>
                <td className="px-2 py-3 font-mono">{r.id === "live" ? "in progress" : r.aiScore}</td>
                <td className="py-3 pl-2">
                  <label htmlFor={`o-${r.id}`} className="sr-only">
                    Override score for {r.student}
                  </label>
                  <input
                    id={`o-${r.id}`}
                    type="number"
                    min={0}
                    max={100}
                    placeholder="—"
                    value={r.override ?? ""}
                    onChange={(e) => setOverride(r.id, e.target.value)}
                    disabled={r.id === "live"}
                    className={`h-9 w-16 rounded-lg border px-2 ${r.override !== null ? "border-accent" : "border-edge"} disabled:bg-ground`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
