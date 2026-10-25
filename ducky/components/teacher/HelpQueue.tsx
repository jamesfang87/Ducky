"use client";

import { useCallback, useEffect, useState } from "react";

interface Peer {
  name: string;
  at: number;
}
interface Escalation {
  id: string;
  student: string;
  problem: number;
  problemText: string;
  note: string;
  stepLabel: string;
  completedSteps: number;
  totalSteps: number;
  hintsUsed: number;
  hintLimit: number;
  openMisconceptions: string[];
  lastTurns: { role: "student" | "tutor"; text: string }[];
  at: number;
  status: "open" | "resolved";
  peers: Record<string, Peer[]>;
}
interface GuardEvent {
  student: string;
  problem: number;
  kind: string;
  excerpt: string;
  at: number;
}

const KIND: Record<string, string> = {
  jailbreak: "Tried to override Ducky",
  answer_hunt: "Asked for the answer",
  rate_limit: "Sent messages too fast",
  answer_leak: "Ducky nearly gave the answer (blocked)",
  hint_limit: "Hit the hint limit",
  visual_declined: "Sketch request declined",
  visual_failed: "Sketch failed",
};

const pretty = (id: string) => id.replace(/[_-]+/g, " ");
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export default function HelpQueue() {
  const [data, setData] = useState<{ escalations: Escalation[]; guardEvents: GuardEvent[] } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/teacher/help", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn't load.");
      setData(j);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load.");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [load]);

  const resolve = async (id: string) => {
    await fetch("/api/teacher/help", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    void load();
  };

  const open = data?.escalations.filter((e) => e.status === "open") ?? [];
  const done = data?.escalations.filter((e) => e.status === "resolved") ?? [];

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold">Help queue</h1>
        <p className="mt-1 text-sm text-sub">Students who raised a hand, with what they're stuck on, and the moments Ducky held a line.</p>
      </div>
      {error && <p className="text-sm text-warn">{error}</p>}

      <section aria-label="Raised hands" className="flex flex-col gap-3">
        <h2 className="font-semibold">Raised hands {open.length > 0 && <span className="chip ml-1">{open.length}</span>}</h2>
        {data && open.length === 0 && <div className="card p-5 text-sm text-sub">No one is waiting. Hands show up here the moment a student raises one.</div>}
        {open.map((e) => (
          <article key={e.id} className="card flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="font-semibold">{e.student}</h3>
              <span className="text-sm text-muted">Problem {e.problem} · {ago(e.at)}</span>
              <button type="button" className="btn ml-auto h-8 px-3 text-sm" onClick={() => void resolve(e.id)}>
                Mark handled
              </button>
            </div>
            {e.note && <p className="text-sm">“{e.note}”</p>}
            <p className="text-sm text-sub">
              On step {Math.min(e.completedSteps + 1, e.totalSteps)} of {e.totalSteps}
              {e.stepLabel ? `: ${e.stepLabel}` : ""}. Hints used: {e.hintsUsed} of {e.hintLimit}.
            </p>
            {e.openMisconceptions.length > 0 && (
              <div className="flex flex-col gap-2">
                {e.openMisconceptions.map((m) => (
                  <div key={m} className="rounded-[10px] bg-accent-tint p-3 text-sm text-accent-dark">
                    <span className="font-semibold">Stuck on: {pretty(m)}.</span>{" "}
                    {e.peers[m]?.length ? (
                      <>Classmates who worked through this and are happy to help: {e.peers[m].map((p) => p.name).join(", ")}.</>
                    ) : (
                      <>No one has opted in as a helper for this yet.</>
                    )}
                  </div>
                ))}
              </div>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer text-sub">Last {e.lastTurns.length} turns</summary>
              <ul className="mt-2 flex flex-col gap-1.5">
                {e.lastTurns.map((t, i) => (
                  <li key={i}>
                    <span className="font-semibold">{t.role === "student" ? e.student.split(" ")[0] : "Ducky"}:</span> {t.text}
                  </li>
                ))}
              </ul>
            </details>
          </article>
        ))}
        {done.length > 0 && <p className="text-sm text-muted">{done.length} handled this session.</p>}
      </section>

      <section aria-label="Flagged moments" className="flex flex-col gap-3">
        <h2 className="font-semibold">Flagged moments</h2>
        {data && data.guardEvents.length === 0 && <div className="card p-5 text-sm text-sub">Nothing flagged. Ducky hasn't had to hold a line yet.</div>}
        {data && data.guardEvents.length > 0 && (
          <ul className="card divide-y divide-line">
            {data.guardEvents.map((g, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 text-sm">
                <span className="font-semibold">{g.student}</span>
                <span className="text-sub">{KIND[g.kind] ?? g.kind}</span>
                <span className="text-muted">Problem {g.problem} · {ago(g.at)}</span>
                {g.excerpt && <span className="w-full truncate text-muted">“{g.excerpt}”</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
