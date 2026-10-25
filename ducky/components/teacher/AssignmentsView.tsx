"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Spinner, Warn } from "@/components/ui/icons";
import { formatDay, type TeacherClass } from "@/lib/classroom";
import {
  assignmentScore,
  attemptKey,
  average,
  formatDuration,
  indexAttempts,
  problemScores,
  type ClassInsights,
  type InsightAssignment,
  type InsightProblem,
} from "@/lib/insights";
import type { LeakHit } from "@/lib/types";
import { Score, BandLegend, RecordingNotice } from "./Mastery";
import { sendJson } from "./dialog";
import { ClassPicker } from "./TeacherShell";

const HEAT = ["bg-heat-0 text-muted", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4 text-ground font-medium"];
const heat = (n: number, max: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((4 * n) / Math.max(max, 1))));

export default function AssignmentsView({
  classes,
  insights: initial,
  recording,
  leakChecks,
  initialSetId,
}: {
  classes: TeacherClass[];
  insights: ClassInsights;
  recording: boolean;
  leakChecks: boolean;
  initialSetId?: string;
}) {
  const [insights, setInsights] = useState(initial);
  const newestFirst = useMemo(() => [...insights.assignments].reverse(), [insights.assignments]);
  const [setId, setSetId] = useState(newestFirst.find((a) => a.id === initialSetId)?.id ?? newestFirst[0]?.id ?? null);
  const attempts = useMemo(() => indexAttempts(insights.attempts), [insights.attempts]);
  const asg = insights.assignments.find((a) => a.id === setId) ?? null;

  const updateProblem = (problemId: string, patch: Partial<InsightProblem>) =>
    setInsights((s) => ({
      ...s,
      assignments: s.assignments.map((a) => ({ ...a, problems: a.problems.map((p) => (p.id === problemId ? { ...p, ...patch } : p)) })),
    }));

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-[1_1_300px]">
          <p className="text-sm text-muted">{insights.courseNumber ?? "Class"}</p>
          <h1 className="mt-0.5 font-display text-[30px] font-bold tracking-tight">Assignments · {insights.className}</h1>
        </div>
        <Link href={`/teacher/classes/${insights.classId}`} className="btn no-underline">
          Upload or edit sets
        </Link>
      </div>
      <ClassPicker classes={classes} currentId={insights.classId} basePath="/teacher/assignments" />
      <RecordingNotice recording={recording} />

      {!newestFirst.length ? (
        <div className="card p-6 text-sm text-sub">
          No problem sets in this class yet. <Link href={`/teacher/classes/${insights.classId}`}>Upload one</Link> to start.
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Problem set" className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {newestFirst.map((a) => {
              const scores = insights.roster.map((r) => assignmentScore(a, r.studentId, attempts));
              const started = insights.roster.filter((r) => a.problems.some((p) => attempts.has(attemptKey(p.id, r.studentId)))).length;
              const leaks = a.problems.filter((p) => p.leak.status === "leaked").length;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={a.id === setId}
                  onClick={() => setSetId(a.id)}
                  className={`card flex flex-col gap-1 p-4 text-left transition hover:border-accent ${a.id === setId ? "border-accent ring-1 ring-accent" : ""}`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-display font-semibold leading-snug">{a.title}</span>
                    <Score score={average(scores)} />
                  </span>
                  <span className="text-[12.5px] text-muted">
                    {a.published ? (a.dueAt ? `Due ${formatDay(a.dueAt)}` : "No due date") : "Draft"} · {a.problems.length} problems
                  </span>
                  <span className="text-[12.5px] text-sub">
                    {started}/{insights.roster.length} students started
                    {leaks > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 text-warn">
                        <Warn size={12} /> {leaks} leak{leaks === 1 ? "" : "s"}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {asg && <SetDetail key={asg.id} asg={asg} insights={insights} attempts={attempts} leakChecks={leakChecks} onProblem={updateProblem} />}
        </>
      )}
    </>
  );
}

function SetDetail({
  asg,
  insights,
  attempts,
  leakChecks,
  onProblem,
}: {
  asg: InsightAssignment;
  insights: ClassInsights;
  attempts: ReturnType<typeof indexAttempts>;
  leakChecks: boolean;
  onProblem: (id: string, patch: Partial<InsightProblem>) => void;
}) {
  const { roster } = insights;
  const rows = roster.map((r) => ({ ...r, scores: problemScores(asg, r.studentId, attempts) }));
  const setAttempts = asg.problems.map((p) => roster.flatMap((r) => attempts.get(attemptKey(p.id, r.studentId)) ?? []));
  const avgTime = setAttempts.map((list) => (list.length ? list.reduce((t, a) => t + a.activeSeconds, 0) / list.length : null));
  const finished = setAttempts.flat().filter((a) => a.completed || a.revealed).length;
  const allTimes = setAttempts.flat().map((a) => a.activeSeconds);

  const stats = [
    { label: "Class average", value: <Score score={average(rows.map((r) => average(r.scores)))} className="text-lg" /> },
    { label: "Problems finished", value: `${finished}`, sub: `/ ${roster.length * asg.problems.length}` },
    { label: "Avg. time per problem", value: allTimes.length ? formatDuration(allTimes.reduce((t, s) => t + s, 0) / allTimes.length) : "—" },
    { label: "Hint penalty", value: asg.policy.hintPenalty ? `−${asg.policy.hintPenalty}` : "None", sub: asg.policy.hintPenalty ? "pts / hint" : undefined },
  ];

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-[13px] text-muted">{s.label}</p>
            <p className="mt-1 font-display text-[28px] font-semibold">
              {s.value} {s.sub && <span className="text-base text-muted">{s.sub}</span>}
            </p>
          </div>
        ))}
      </div>

      <section aria-label="Student performance" className="card min-w-0 p-5">
        <div className="mb-3.5 flex flex-wrap items-baseline gap-2">
          <h2 className="font-display text-lg font-semibold">Student performance</h2>
          <span className="text-[13px] text-muted">score and time on each problem</span>
          <span className="flex-1" />
          <BandLegend />
        </div>
        {roster.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.06em] text-muted">
                  <th className="pb-1.5 pr-2 text-left font-semibold">Student</th>
                  {asg.problems.map((p) => (
                    <th key={p.id} scope="col" className="pb-1.5 font-semibold" title={p.prompt}>
                      P{p.position}
                    </th>
                  ))}
                  <th className="pb-1.5 font-semibold">Set</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.studentId}>
                    <th scope="row" className="py-1 pr-2 text-left font-semibold">
                      {r.name}
                    </th>
                    {asg.problems.map((p, i) => {
                      const a = attempts.get(attemptKey(p.id, r.studentId));
                      const sub = a ? (a.revealed ? "revealed" : formatDuration(a.activeSeconds)) : undefined;
                      return (
                        <td key={p.id} className="text-center">
                          <Score score={r.scores[i]} sub={sub} />
                        </td>
                      );
                    })}
                    <td className="text-center">
                      <Score score={average(r.scores)} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-[12.5px] text-muted">
                  <th scope="row" className="pt-2 pr-2 text-left font-normal">
                    Avg. time
                  </th>
                  {avgTime.map((t, i) => (
                    <td key={i} className="pt-2 text-center font-mono">
                      {t === null ? "—" : formatDuration(t)}
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No students have joined this class yet. Share the join code from the class page.</p>
        )}
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <MisconceptionHeatmap asg={asg} insights={insights} />
        <LeakPanel asg={asg} enabled={leakChecks} onProblem={onProblem} />
      </div>

      <ConceptTags asg={asg} onProblem={onProblem} />
    </>
  );
}

function MisconceptionHeatmap({ asg, insights }: { asg: InsightAssignment; insights: ClassInsights }) {
  const { labels, grid, max } = useMemo(() => {
    const at = new Map(asg.problems.map((p, i) => [p.id, i]));
    const students = new Map<string, Set<string>[]>();
    for (const m of insights.misconceptions) {
      const i = at.get(m.problemId);
      if (i === undefined) continue;
      const row = students.get(m.label) ?? students.set(m.label, asg.problems.map(() => new Set())).get(m.label)!;
      row[i].add(m.studentId);
    }
    const g = [...students].map(([label, cells]) => ({ label, counts: cells.map((c) => c.size) }));
    g.sort((a, b) => b.counts.reduce((t, n) => t + n, 0) - a.counts.reduce((t, n) => t + n, 0));
    return { labels: g.map((r) => r.label), grid: g, max: Math.max(0, ...g.flatMap((r) => r.counts)) };
  }, [asg, insights.misconceptions]);

  return (
    <section aria-label="Misconception heatmap" className="card min-w-0 flex-[3_1_480px] p-5">
      <div className="mb-3.5 flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-lg font-semibold">Misconception heatmap</h2>
        <span className="text-[13px] text-muted">students affected, by problem</span>
      </div>
      {labels.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-separate border-spacing-1 text-[13px]">
            <thead>
              <tr>
                <th className="sr-only">Misconception</th>
                {asg.problems.map((p) => (
                  <th key={p.id} scope="col" className="font-semibold text-muted">
                    P{p.position}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className="max-w-[260px] py-2 pr-2 text-left font-normal">
                    {r.label}
                  </th>
                  {r.counts.map((n, i) => (
                    <td key={i} className={`rounded-md text-center font-mono ${HEAT[heat(n, max)]}`}>
                      {n}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">No misconceptions detected on this set yet.</p>
      )}
    </section>
  );
}

function LeakPanel({ asg, enabled, onProblem }: { asg: InsightAssignment; enabled: boolean; onProblem: (id: string, patch: Partial<InsightProblem>) => void }) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leaked = asg.problems.filter((p) => p.leak.status === "leaked");
  const checked = asg.problems.map((p) => p.leak.checkedAt).filter((d): d is string => !!d).sort().pop();

  const run = async () => {
    setChecking(true);
    setError(null);
    try {
      const { results } = await sendJson<{ results: { problemId: string; status: "clean" | "leaked"; hits: LeakHit[]; checkedAt: string }[] }>(
        "/api/teacher/leaks",
        "POST",
        { assignmentId: asg.id },
      );
      for (const r of results) onProblem(r.problemId, { leak: { status: r.status, hits: r.hits, checkedAt: r.checkedAt } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The leak check failed.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <section aria-label="Answer leaks" className={`card min-w-0 flex-[2_1_320px] p-5 ${leaked.length ? "border-warn-soft" : ""}`}>
      <div className="mb-1 flex items-center gap-2.5">
        <Search className={leaked.length ? "text-warn" : "text-muted"} />
        <h2 className="font-display text-lg font-semibold">Answer leaks</h2>
      </div>
      <p className="mb-3.5 text-[13px] text-muted">
        Web search for each problem · {checked ? `last checked ${new Date(checked).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "not checked yet"}
      </p>

      {checked && !leaked.length && <p className="text-sm text-sub">No copies of these problems found online.</p>}
      <ul className="flex flex-col gap-2.5">
        {leaked.map((p) => (
          <li key={p.id} className="rounded-[10px] bg-ground px-3 py-2.5">
            <p className="text-[13px] font-semibold text-warn-dark">Problem {p.position}</p>
            <ul className="mt-1 flex flex-col gap-1">
              {p.leak.hits.map((h) => (
                <li key={h.url} className="flex items-center gap-3">
                  <a href={h.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[13px]" title={h.title}>
                    <span className="font-semibold">{h.domain}</span> · {h.title}
                  </a>
                  <span className="font-mono text-[13px] font-medium text-warn">{h.match}%</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-3 text-sm text-warn-dark">
          {error}
        </p>
      )}
      <div className="mt-3.5">
        <button type="button" className="btn h-10" onClick={run} disabled={checking || !enabled} title={enabled ? undefined : "Needs SERPAPI_KEY on the server"}>
          {checking ? (
            <>
              <Spinner /> Searching…
            </>
          ) : checked ? (
            "Re-check now"
          ) : (
            "Check for leaks"
          )}
        </button>
        {!enabled && <p className="mt-2 text-[12.5px] text-muted">Leak checks need SERPAPI_KEY on the server.</p>}
      </div>
    </section>
  );
}

function ConceptTags({ asg, onProblem }: { asg: InsightAssignment; onProblem: (id: string, patch: Partial<InsightProblem>) => void }) {
  const known = useMemo(() => [...new Set(asg.problems.flatMap((p) => p.concepts))], [asg.problems]);
  return (
    <section aria-label="Concepts" className="card min-w-0 p-5">
      <div className="mb-3.5 flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-lg font-semibold">Concepts</h2>
        <span className="text-[13px] text-muted">tag each problem; Transcripts shows mastery by concept</span>
      </div>
      <datalist id={`concepts-${asg.id}`}>
        {known.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <ul className="flex flex-col divide-y divide-line">
        {asg.problems.map((p) => (
          <ProblemConcepts key={p.id} problem={p} listId={`concepts-${asg.id}`} onChange={(concepts) => onProblem(p.id, { concepts })} />
        ))}
      </ul>
    </section>
  );
}

function ProblemConcepts({ problem, listId, onChange }: { problem: InsightProblem; listId: string; onChange: (c: string[]) => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (next: string[]) => {
    const prev = problem.concepts;
    onChange(next);
    setSaving(true);
    setError(null);
    try {
      const { concepts } = await sendJson<{ concepts: string[] }>(`/api/teacher/problems/${problem.id}`, "PATCH", { concepts: next });
      onChange(concepts);
    } catch (e) {
      onChange(prev);
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    const c = text.replace(/\s+/g, " ").trim();
    setText("");
    if (c && !problem.concepts.some((x) => x.toLowerCase() === c.toLowerCase())) save([...problem.concepts, c]);
  };

  const prompt = problem.prompt.replace(/\s+/g, " ");
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="min-w-0 flex-[1_1_260px] text-sm">
        <span className="font-semibold">P{problem.position}</span> <span className="text-sub">{prompt.length > 110 ? `${prompt.slice(0, 107)}…` : prompt}</span>
      </span>
      <span className="flex flex-[1_1_300px] flex-wrap items-center gap-1.5">
        {problem.concepts.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-full bg-accent-tint py-1 pl-2.5 pr-1 text-[13px] text-accent-dark">
            {c}
            <button
              type="button"
              aria-label={`Remove ${c}`}
              disabled={saving}
              onClick={() => save(problem.concepts.filter((x) => x !== c))}
              className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-surface"
            >
              ×
            </button>
          </span>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex"
        >
          <label htmlFor={`concept-${problem.id}`} className="sr-only">
            Add a concept to problem {problem.position}
          </label>
          <input
            id={`concept-${problem.id}`}
            list={listId}
            value={text}
            maxLength={40}
            onChange={(e) => setText(e.target.value)}
            onBlur={add}
            placeholder="+ concept"
            className="h-8 w-32 rounded-full border border-dashed border-edge bg-surface px-3 text-[13px] placeholder:text-muted focus:border-accent"
          />
        </form>
        {saving && <Spinner />}
        {error && <span className="text-[12.5px] text-warn-dark">{error}</span>}
      </span>
    </li>
  );
}
