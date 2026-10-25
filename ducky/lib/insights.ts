/**
 * What the teacher's Assignments and Transcripts pages read (built in lib/server/insights.ts),
 * plus the grading rules. Safe for client components.
 *
 * Grading: a problem scores the share of its reasoning steps the student explained,
 * minus the set's hint penalty per hint, and 0 if they viewed the answer. An assignment
 * (or concept) scores the average of its problems; unattempted problems count as 0 once
 * the set is past due and are left out before that.
 */
import type { LeakHit, Policy } from "./types";

export type LeakStatus = "unchecked" | "clean" | "leaked" | "mutated";

export interface InsightProblem {
  id: string;
  position: number;
  prompt: string;
  /** Teacher-tagged concepts (AI tagging later). */
  concepts: string[];
  leak: { status: LeakStatus; checkedAt: string | null; hits: LeakHit[] };
}

export interface InsightAssignment {
  id: string;
  title: string;
  published: boolean;
  dueAt: string | null;
  createdAt: string;
  policy: Policy;
  problems: InsightProblem[];
}

export interface Attempt {
  problemId: string;
  studentId: string;
  hintsUsed: number;
  stepsDone: number;
  stepsTotal: number;
  revealed: boolean;
  completed: boolean;
  /** Time spent on the question (idle gaps over 5 minutes don't count). */
  activeSeconds: number;
  startedAt: string;
}

export interface MisconceptionHit {
  problemId: string;
  studentId: string;
  label: string;
  at: string;
}

export interface ClassInsights {
  classId: string;
  className: string;
  courseNumber: string | null;
  roster: { studentId: string; name: string }[];
  assignments: InsightAssignment[];
  attempts: Attempt[];
  misconceptions: MisconceptionHit[];
}

/** A saved tutor agent (Tutor agents page). */
export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  policy: Policy;
  updatedAt: string;
}

/** A problem set an agent can be applied to. */
export interface TeacherSetOption {
  id: string;
  title: string;
  className: string;
  policy: Policy;
}

export const attemptKey = (problemId: string, studentId: string) => `${problemId}:${studentId}`;

export function indexAttempts(attempts: Attempt[]): Map<string, Attempt> {
  return new Map(attempts.map((a) => [attemptKey(a.problemId, a.studentId), a]));
}

/** 0–100 for one attempt. */
export function problemScore(a: Attempt, hintPenalty: number): number {
  if (a.revealed) return 0;
  const steps = a.completed ? 100 : a.stepsTotal ? (100 * a.stepsDone) / a.stepsTotal : 0;
  return Math.max(0, Math.round(steps - a.hintsUsed * hintPenalty));
}

export const isPastDue = (asg: Pick<InsightAssignment, "dueAt">, now = Date.now()) => !!asg.dueAt && Date.parse(asg.dueAt) < now;

/** A student's score on each problem: a number, or null if unattempted and not yet due. */
export function problemScores(asg: InsightAssignment, studentId: string, attempts: Map<string, Attempt>, now = Date.now()): (number | null)[] {
  const due = isPastDue(asg, now);
  return asg.problems.map((p) => {
    const a = attempts.get(attemptKey(p.id, studentId));
    return a ? problemScore(a, asg.policy.hintPenalty) : due ? 0 : null;
  });
}

export function average(scores: (number | null)[]): number | null {
  const s = scores.filter((x): x is number => x !== null);
  return s.length ? Math.round(s.reduce((t, x) => t + x, 0) / s.length) : null;
}

export function assignmentScore(asg: InsightAssignment, studentId: string, attempts: Map<string, Attempt>, now = Date.now()): number | null {
  return average(problemScores(asg, studentId, attempts, now));
}

/** Every concept tagged in the class, alphabetical. */
export function allConcepts(assignments: InsightAssignment[]): string[] {
  return [...new Set(assignments.flatMap((a) => a.problems.flatMap((p) => p.concepts)))].sort((a, b) => a.localeCompare(b));
}

/** A student's average on the problems tagged with each concept. */
export function conceptScores(assignments: InsightAssignment[], studentId: string, attempts: Map<string, Attempt>, now = Date.now()): Map<string, number | null> {
  const by = new Map<string, (number | null)[]>();
  for (const asg of assignments) {
    const scores = problemScores(asg, studentId, attempts, now);
    asg.problems.forEach((p, i) => {
      for (const c of p.concepts) (by.get(c) ?? by.set(c, []).get(c)!).push(scores[i]);
    });
  }
  return new Map([...by].map(([c, s]) => [c, average(s)]));
}

/** Mastery bands: 90+ green, 80–89 yellow, 70–79 orange, below 70 red. */
export function band(score: number | null): { label: string; className: string } {
  if (score === null) return { label: "Not started", className: "bg-ground text-muted" };
  if (score >= 90) return { label: "Mastered", className: "bg-grade-a text-grade-a-ink" };
  if (score >= 80) return { label: "Proficient", className: "bg-grade-b text-grade-b-ink" };
  if (score >= 70) return { label: "Developing", className: "bg-grade-c text-grade-c-ink" };
  return { label: "Needs support", className: "bg-grade-d text-grade-d-ink" };
}

export const BANDS = [
  { range: "90+", ...band(95) },
  { range: "80–89", ...band(85) },
  { range: "70–79", ...band(75) },
  { range: "Below 70", ...band(50) },
];

/** "4m 05s", "52s", "1h 12m". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
