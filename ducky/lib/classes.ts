/**
 * Demo class catalog, shown alongside the student's real Supabase classes
 * (lib/server/classroom.ts, joined with the `join_class(code)` RPC).
 */

import { getClassProgress, getProblemSets, summarizeProgress, type ProblemSetRecord } from "./problemSets";

export type ClassTone = "accent" | "amber" | "blue" | "violet";

export interface ClassRecord {
  id: string;
  course: string;
  name: string;
  teacher: string;
  term: string;
  /** 6 characters, no ambiguous 0/O/1/I/L, matching the backend generator. */
  joinCode: string;
  tone: ClassTone;
  /** Posted sets for a real class. Demo classes leave this out and use the demo catalog. */
  sets?: ProblemSetRecord[];
}

export const CLASSES: ClassRecord[] = [
  {
    id: "phys-1401",
    course: "PHYS 1401",
    name: "Mechanics & Waves",
    teacher: "D. Rivera",
    term: "Fall 2026",
    joinCode: "PHY4K2",
    tone: "accent",
  },
  {
    id: "cs-314",
    course: "CS 314",
    name: "Data Structures",
    teacher: "M. Ortiz",
    term: "Fall 2026",
    joinCode: "CSC9X2",
    tone: "blue",
  },
  {
    id: "math-325k",
    course: "MATH 325K",
    name: "Discrete Mathematics",
    teacher: "R. Iyer",
    term: "Fall 2026",
    joinCode: "MTH4D2",
    tone: "violet",
  },
];

export const CLASS_BY_ID: Record<string, ClassRecord> = Object.fromEntries(
  CLASSES.map((record) => [record.id, record]),
);

/**
 * Classes the demo student starts with.
 *
 * Supabase `classIds` are UUIDs, so they never match this mock catalog. Until
 * the catalog is replaced with a real `classes` query, a student with no mock
 * enrollment falls back to this list instead of an empty page.
 */
export const DEMO_ENROLLMENT_IDS = ["phys-1401", "cs-314", "math-325k"];

/** Uppercase, strip separators, cap at 6. Safe to run on every keystroke. */
export function normalizeJoinCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export function findClassByCode(input: string): ClassRecord | undefined {
  const code = normalizeJoinCode(input);
  if (code.length !== 6) return undefined;
  return CLASSES.find((record) => record.joinCode === code);
}

export interface ClassSummary {
  sets: ProblemSetRecord[];
  problems: number;
  completed: number;
  pct: number;
  due: string | null;
  activeSet: ProblemSetRecord | null;
}

/** Everything the class card and class page need, derived from the posted sets. */
export function getClassSummary(record: ClassRecord): ClassSummary {
  const sets = record.sets ? [...record.sets].sort((a, b) => b.number - a.number) : getProblemSets(record.id);
  const { problems, completed, due, activeSet } = record.sets ? summarizeProgress(sets) : getClassProgress(record.id);
  return {
    sets,
    problems,
    completed,
    pct: problems > 0 ? Math.round((completed / problems) * 100) : 0,
    due,
    activeSet,
  };
}
