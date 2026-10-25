"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import type { TeacherClass } from "@/lib/classroom";
import { allConcepts, assignmentScore, attemptKey, average, conceptScores, formatDuration, indexAttempts, problemScores, type ClassInsights } from "@/lib/insights";
import { BandLegend, RecordingNotice, Score } from "./Mastery";
import { ClassPicker } from "./TeacherShell";

type View = "assignments" | "concepts";

export default function TranscriptsView({ classes, insights, recording }: { classes: TeacherClass[]; insights: ClassInsights; recording: boolean }) {
  const [view, setView] = useState<View>("assignments");
  const [open, setOpen] = useState<string | null>(null);
  const attempts = useMemo(() => indexAttempts(insights.attempts), [insights.attempts]);
  // Drafts aren't visible to students, so they don't count toward grades.
  const sets = useMemo(() => insights.assignments.filter((a) => a.published), [insights.assignments]);
  const concepts = useMemo(() => allConcepts(sets), [sets]);

  const rows = useMemo(
    () =>
      insights.roster.map((r) => {
        const bySet = sets.map((a) => assignmentScore(a, r.studentId, attempts));
        const byConcept = conceptScores(sets, r.studentId, attempts);
        return { ...r, bySet, byConcept, overall: average(bySet) };
      }),
    [insights.roster, sets, attempts],
  );

  const columns = view === "assignments" ? sets.map((a) => ({ key: a.id, label: a.title })) : concepts.map((c) => ({ key: c, label: c }));
  const cell = (row: (typeof rows)[number], i: number) => (view === "assignments" ? row.bySet[i] : (row.byConcept.get(concepts[i]) ?? null));

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-[1_1_300px]">
          <p className="text-sm text-muted">{insights.courseNumber ?? "Class"}</p>
          <h1 className="mt-0.5 font-display text-[30px] font-bold tracking-tight">Transcripts · {insights.className}</h1>
          <p className="mt-1 text-sub">Each student’s grade on every assignment, colored by mastery.</p>
        </div>
      </div>
      <ClassPicker classes={classes} currentId={insights.classId} basePath="/teacher/transcripts" />
      <RecordingNotice recording={recording} />

      <section aria-label="Grades" className="card min-w-0 p-5">
        <div className="mb-3.5 flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Group grades by" className="flex rounded-full border border-edge p-0.5">
            {(["assignments", "concepts"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`h-8 rounded-full px-3.5 text-sm capitalize transition ${view === v ? "bg-ink text-ground" : "text-sub hover:bg-ground"}`}
              >
                By {v === "assignments" ? "assignment" : "concept"}
              </button>
            ))}
          </div>
          <span className="flex-1" />
          <BandLegend />
        </div>

        {!insights.roster.length ? (
          <p className="text-sm text-muted">No students have joined this class yet.</p>
        ) : !columns.length ? (
          <p className="text-sm text-muted">
            {view === "assignments" ? (
              "No published assignments yet."
            ) : (
              <>
                No concepts tagged yet. Tag problems on the <Link href={`/teacher/assignments?class=${insights.classId}`}>Assignments</Link> page.
              </>
            )}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="pb-1.5 pr-2 text-left font-semibold uppercase tracking-[0.06em]">Student</th>
                  <th className="pb-1.5 font-semibold uppercase tracking-[0.06em]">Overall</th>
                  {columns.map((c) => (
                    <th key={c.key} scope="col" className="max-w-[140px] pb-1.5 font-semibold leading-tight">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.studentId}>
                    <tr>
                      <th scope="row" className="py-1 pr-2 text-left">
                        <button
                          type="button"
                          aria-expanded={open === r.studentId}
                          onClick={() => setOpen(open === r.studentId ? null : r.studentId)}
                          className="flex items-center gap-1.5 font-semibold hover:text-accent-dark"
                        >
                          <span className={`text-[10px] text-muted transition ${open === r.studentId ? "rotate-90" : ""}`} aria-hidden="true">
                            ▶
                          </span>
                          {r.name}
                        </button>
                      </th>
                      <td className="text-center">
                        <Score score={r.overall} className="font-semibold" />
                      </td>
                      {columns.map((c, i) => (
                        <td key={c.key} className="text-center">
                          <Score score={cell(r, i)} />
                        </td>
                      ))}
                    </tr>
                    {open === r.studentId && (
                      <tr>
                        <td colSpan={columns.length + 2} className="rounded-[10px] bg-ground p-3">
                          <StudentDetail studentId={r.studentId} insights={insights} attempts={attempts} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-[12.5px] text-muted">
                  <th scope="row" className="pt-2 pr-2 text-left font-normal">
                    Class average
                  </th>
                  <td className="pt-2 text-center">
                    <Score score={average(rows.map((r) => r.overall))} />
                  </td>
                  {columns.map((c, i) => (
                    <td key={c.key} className="pt-2 text-center">
                      <Score score={average(rows.map((r) => cell(r, i)))} />
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/** Per-problem breakdown for one student, under their row. */
function StudentDetail({ studentId, insights, attempts }: { studentId: string; insights: ClassInsights; attempts: ReturnType<typeof indexAttempts> }) {
  const sets = insights.assignments.filter((a) => a.published);
  if (!sets.length) return <p className="text-sm text-muted">No published assignments.</p>;
  return (
    <div className="flex flex-col gap-3">
      {sets.map((a) => {
        const scores = problemScores(a, studentId, attempts);
        return (
          <div key={a.id}>
            <p className="mb-1.5 text-[13px] font-semibold">{a.title}</p>
            <div className="flex flex-wrap gap-2">
              {a.problems.map((p, i) => {
                const at = attempts.get(attemptKey(p.id, studentId));
                const detail = at
                  ? [at.revealed ? "viewed answer" : `${at.stepsDone}/${at.stepsTotal} steps`, `${at.hintsUsed} hint${at.hintsUsed === 1 ? "" : "s"}`, formatDuration(at.activeSeconds)].join(" · ")
                  : "not started";
                return (
                  <span key={p.id} className="flex items-center gap-2 rounded-[10px] bg-surface px-2.5 py-1.5 text-[12.5px]" title={p.prompt}>
                    <span className="font-semibold">P{p.position}</span>
                    <Score score={scores[i]} />
                    <span className="text-muted">{detail}</span>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
