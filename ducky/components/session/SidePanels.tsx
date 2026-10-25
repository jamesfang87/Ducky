"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Resource } from "@/lib/api";
import type { ChatMessage, MisconceptionId, Problem, ReasoningStep } from "@/lib/types";
import { MISCONCEPTIONS } from "@/lib/mock";
import { RUBRIC_MAX, type RubricRow } from "@/lib/rubric";
import { Check, Send } from "@/components/ui/icons";

export function ProblemCard({
  problem,
  nextHref,
  backHref,
  onReset,
  resetting,
  resetError,
}: {
  problem: Problem;
  /** The next problem in this set, if there is one. */
  nextHref?: string;
  /** Where to go after the last problem. */
  backHref?: string;
  /** Clear this student's progress on just this problem. */
  onReset?: () => void;
  resetting?: boolean;
  resetError?: string | null;
}) {
  return (
    <div className="card p-5">
      <div className="mb-3.5 flex gap-1.5" aria-label={`Problem ${problem.index} of ${problem.total}`}>
        {Array.from({ length: problem.total }, (_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded ${i < problem.index - 1 ? "bg-accent" : i === problem.index - 1 ? "bg-accent/45" : "bg-line"}`}
          />
        ))}
      </div>
      <p className="eyebrow mb-1.5">Problem {problem.index}</p>
      {problem.prompt.includes("\n") ? (
        <pre className="overflow-x-auto whitespace-pre font-mono text-[13px] leading-relaxed">{problem.prompt}</pre>
      ) : (
        <p className="text-base leading-relaxed">{problem.prompt}</p>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] text-muted">
              Problem {problem.index} of {problem.total}
            </span>
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                disabled={resetting}
                className="rounded-md border border-line px-2 py-1 text-[12px] font-medium text-sub transition hover:border-warn hover:text-warn disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resetting ? "Clearing…" : "Clear progress"}
              </button>
            )}
          </div>
          {nextHref ? (
            <Link href={nextHref} className="btn-primary h-9 px-3 text-sm no-underline">
              Next problem <Send size={13} />
            </Link>
          ) : backHref ? (
            <Link href={backHref} className="btn h-9 px-3 text-sm no-underline">
              Back to problem sets
            </Link>
          ) : null}
        </div>
        {resetError && (
          <p role="alert" className="mt-2 text-[12.5px] text-warn">
            {resetError}
          </p>
        )}
      </div>
    </div>
  );
}

export function ReasoningPath({ steps }: { steps: ReasoningStep[] }) {
  return (
    <div className="card p-5">
      <h2 className="h2 mb-3">Your reasoning path</h2>
      <ol className="flex flex-col">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 pb-3 last:pb-0">
            {s.status === "done" && (
              <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-accent text-onaccent">
                <Check />
              </span>
            )}
            {s.status === "broke" && (
              <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-warn text-[13px] font-bold text-ground">
                !
              </span>
            )}
            {s.status === "current" && <span className="h-[22px] w-[22px] flex-none rounded-full border-2 border-accent bg-accent-tint" />}
            {s.status === "todo" && <span className="h-[22px] w-[22px] flex-none rounded-full border-2 border-edge" />}
            <span className={s.status === "todo" ? "text-muted" : s.status === "current" ? "font-semibold" : ""}>
              {s.label}
              {s.note && <span className="block text-[13px] text-warn">{s.note}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function MisconceptionTracker({
  counts,
  items,
  stuckStep,
}: {
  counts: Partial<Record<MisconceptionId, number>> | Record<string, number>;
  /** This problem's misconceptions; defaults to the physics demo list. */
  items?: { id: string; label: string }[];
  /** The reasoning step where the student ran out of hints and viewed the answer. */
  stuckStep?: string | null;
}) {
  const byId = counts as Record<string, number>;
  const rows = (items ?? MISCONCEPTIONS).map((m) => ({ ...m, n: byId[m.id] ?? 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  const max = Math.max(4, ...rows.map((r) => r.n));
  const top = rows[0];

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="h2">Misconception tracker</h2>
        <span className="text-[13px] text-muted">this unit</span>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.id}>
            <div className="flex justify-between text-sm">
              <span>{r.label}</span>
              <span className={`font-mono font-medium ${r.n >= 2 ? "text-warn" : "text-muted"}`}>{r.n}×</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-ground">
              <div
                className="h-1.5 rounded transition-all duration-500"
                style={{ width: `${(r.n / max) * 100}%`, background: r.n >= 3 ? "#A3530A" : r.n === 2 ? "#D9934F" : "#EBC49B" }}
              />
            </div>
          </div>
        ))}
      </div>
      {rows.length === 0 && !stuckStep && <p className="text-sm text-muted">Nothing flagged yet.</p>}
      {stuckStep && (
        <div className="mt-3 rounded-[10px] border border-warn/40 px-3 py-2.5 text-[13px]">
          <p className="font-semibold text-warn-dark">Ran out of hints</p>
          <p className="mt-0.5 text-sub">
            Stuck at: <span className="text-ink">{stuckStep}</span>. You viewed the answer, so this problem earns no credit.
          </p>
        </div>
      )}
      {top && top.n >= 3 && (
        <p className="mt-3.5 rounded-[10px] bg-warn-tint px-3 py-2.5 text-[13px] text-warn-dark">
          You’ve hit “{top.label.toLowerCase()}” {top.n} times.{" "}
          {items ? "Try explaining that idea out loud in your own words." : "Try explaining why the force grows but the acceleration doesn’t."}
        </p>
      )}
    </div>
  );
}

export function RubricCard({ rows, messages }: { rows: RubricRow[]; messages: ChatMessage[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scored = rows.filter((r) => r.score !== null);
  const total = scored.reduce((sum, r) => sum + (r.score ?? 0), 0);

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="h2">Your rubric scores</h2>
        {scored.length ? (
          <span className="font-mono text-sm font-medium">
            {total} / {scored.length * RUBRIC_MAX}
          </span>
        ) : (
          <span className="text-[13px] text-muted">not started</span>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="flex justify-between gap-2 text-sm">
              <span>{r.label}</span>
              <span className="font-mono font-medium text-muted">{r.score === null ? "—" : `${r.score}/${RUBRIC_MAX}`}</span>
            </div>
            <div className="mt-1 flex gap-1" aria-hidden="true">
              {Array.from({ length: RUBRIC_MAX }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded transition-colors duration-500 ${
                    r.score !== null && i < r.score ? (r.score <= 1 ? "bg-warn" : "bg-accent") : "bg-ground"
                  }`}
                />
              ))}
            </div>
            <p className="mt-1 text-[13px] text-muted">{r.why}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3.5 text-[13px] text-muted">Scored by Ducky as you go. Your teacher can adjust any score.</p>
      <button className="btn mt-3 h-10 w-full" onClick={() => dialog.current?.showModal()}>
        View full transcript ({messages.length})
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="transcript-title"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="w-[min(640px,calc(100vw-32px))] rounded-[14px] p-0 text-ink backdrop:bg-ink/40"
      >
        <div className="flex max-h-[80vh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 id="transcript-title" className="h2">
              Session transcript
            </h2>
            <button className="btn h-9" onClick={() => dialog.current?.close()}>
              Close
            </button>
          </div>
          <ol className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
            {messages.map((m) => (
              <li key={m.id} className={m.role === "system" ? "text-center text-[13px] text-muted" : ""}>
                {m.role === "system" ? (
                  m.text
                ) : (
                  <>
                    <p className="eyebrow">
                      {m.role === "student"
                        ? `You · ${m.via === "voice" ? `voice, ${m.durationSec ?? 0}s` : "typed"}`
                        : "Ducky"}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-relaxed">{m.text}</p>
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
      </dialog>
    </div>
  );
}

export type ResourcesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; query: string; resources: Resource[] }
  | { status: "error"; message: string };

/** Where to learn the idea behind the current step: SerpApi results, answer sites filtered out. */
export function ResourcesCard({ state, onSearch }: { state: ResourcesState; onSearch: (topic?: string) => void }) {
  const [topic, setTopic] = useState("");
  return (
    <div className="card p-5">
      <h2 className="h2 mb-1">Where to learn this</h2>
      <p className="mb-3 text-[13px] text-muted">Explanations and notes on the idea you’re working on, not answers to this problem.</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch(topic.trim() || undefined);
        }}
      >
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Your current step"
          aria-label="What to look up"
          className="h-9 min-w-0 flex-1 rounded-[10px] border border-edge px-3 text-sm"
        />
        <button type="submit" className="btn h-9 px-3 text-sm" disabled={state.status === "loading"}>
          {state.status === "loading" ? "Searching…" : "Find"}
        </button>
      </form>
      {state.status === "error" && <p className="mt-3 text-sm text-warn">{state.message}</p>}
      {state.status === "ok" && (
        <>
          <p className="mt-3 text-[13px] text-muted">For “{state.query}” · via SerpApi</p>
          {state.resources.length === 0 && <p className="mt-1 text-sm text-muted">Nothing useful turned up. Try different words.</p>}
          <ul className="mt-2 flex flex-col gap-3">
            {state.resources.map((r) => (
              <li key={r.link}>
                <a href={r.link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent no-underline hover:text-accent-dark">
                  {r.title}
                </a>
                <p className="text-[13px] text-muted">{r.source}</p>
                <p className="mt-0.5 text-[13px] text-sub">{r.snippet}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function ExampleCard() {
  return (
    <div className="card px-5 py-4">
      <p className="eyebrow mb-2">Real-world example · via SerpApi</p>
      <a href="https://www.google.com/search?q=apollo+15+hammer+feather" target="_blank" rel="noreferrer" className="font-semibold text-accent no-underline hover:text-accent-dark">
        Apollo 15: a hammer and a feather dropped on the Moon
      </a>
      <p className="mt-1 text-sm text-muted">With no air, both land together. Unlocked after you explain it yourself.</p>
    </div>
  );
}
