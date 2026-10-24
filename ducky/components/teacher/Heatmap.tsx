"use client";

import { useMemo } from "react";
import { BASE_HEATMAP, MISCONCEPTIONS } from "@/lib/mock";
import type { MisconceptionEvent, MisconceptionId } from "@/lib/types";

const LEVELS = ["bg-heat-0 text-muted", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4 text-white font-medium"];
const level = (n: number) => (n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4);

export default function Heatmap({ events }: { events: MisconceptionEvent[] }) {
  const { grid, recent } = useMemo(() => {
    const g: Record<MisconceptionId, number[]> = JSON.parse(JSON.stringify(BASE_HEATMAP));
    const r = new Set<string>();
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const e of events) {
      g[e.misconception][e.problem - 1] += 1;
      if (e.at > cutoff) r.add(`${e.misconception}:${e.problem}`);
    }
    return { grid: g, recent: r };
  }, [events]);

  const liveCount = events.filter((e) => Date.now() - e.at < 60 * 60 * 1000).length;
  const latest = events[events.length - 1];
  const latestLabel = latest && MISCONCEPTIONS.find((m) => m.id === latest.misconception)?.label;

  return (
    <section aria-label="Misconception heatmap" className="card min-w-0 flex-[3_1_480px] p-5">
      <div className="mb-3.5 flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-lg font-semibold">Misconception heatmap</h2>
        <span className="text-[13px] text-muted">students affected, by problem</span>
        {liveCount > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-[13px] text-accent-dark">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> live
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-1 text-[13px]">
          <thead>
            <tr>
              <th className="sr-only">Misconception</th>
              {[1, 2, 3, 4, 5, 6].map((p) => (
                <th key={p} scope="col" className="font-semibold text-muted">
                  P{p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MISCONCEPTIONS.map((m) => (
              <tr key={m.id}>
                <th scope="row" className="py-2.5 pr-2 text-left font-normal">
                  {m.label}
                </th>
                {grid[m.id].map((n, i) => {
                  const hot = recent.has(`${m.id}:${i + 1}`);
                  return (
                    <td
                      key={i}
                      className={`rounded-md text-center font-mono transition-colors duration-700 ${LEVELS[level(n)]} ${hot ? "ring-2 ring-ink" : ""}`}
                    >
                      {n}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>Fewer</span>
        <span className="flex gap-[3px]" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`h-3 w-[22px] rounded-[3px] bg-heat-${l} ${l === 0 ? "border border-line" : ""}`} />
          ))}
        </span>
        <span>More</span>
        <span className="flex-1" />
        {latest ? (
          <span className="text-ink">
            P{latest.problem} · {latestLabel?.toLowerCase()} +{liveCount} in the last hour
          </span>
        ) : (
          <span>Waiting for live sessions…</span>
        )}
      </div>
    </section>
  );
}
