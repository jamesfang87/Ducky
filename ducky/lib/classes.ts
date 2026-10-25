/**
 * Demo class catalog. Replace with Supabase `classes` + `enrollments` queries
 * (and the `join_class(code)` RPC) once the frontend talks to the backend.
 */

export type ClassTone = "accent" | "amber" | "blue";

export interface ClassRecord {
  id: string;
  course: string;
  name: string;
  teacher: string;
  term: string;
  /** 6 characters, no ambiguous 0/O/1/I/L, matching the backend generator. */
  joinCode: string;
  assignments: number;
  completed: number;
  nextDue: string | null;
  activeAssignment: { label: string; href: string } | null;
  tone: ClassTone;
}

export const CLASSES: ClassRecord[] = [
  {
    id: "phys-1401",
    course: "PHYS 1401",
    name: "Mechanics & Waves",
    teacher: "D. Rivera",
    term: "Fall 2026",
    joinCode: "PHY4K2",
    assignments: 6,
    completed: 2,
    nextDue: "Fri, Oct 30",
    activeAssignment: { label: "Problem Set 3 · Free fall", href: "/session/demo" },
    tone: "accent",
  },
  {
    id: "chem-1101",
    course: "CHEM 1101",
    name: "General Chemistry I",
    teacher: "A. Patel",
    term: "Fall 2026",
    joinCode: "CHM7Q3",
    assignments: 0,
    completed: 0,
    nextDue: null,
    activeAssignment: null,
    tone: "amber",
  },
  {
    id: "cs-314",
    course: "CS 314",
    name: "Data Structures",
    teacher: "M. Ortiz",
    term: "Fall 2026",
    joinCode: "CSC9X2",
    assignments: 4,
    completed: 0,
    nextDue: "Mon, Nov 2",
    activeAssignment: { label: "Problem Set 1 · Insertion sort", href: "/session/demo-cs" },
    tone: "blue",
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
export const DEMO_ENROLLMENT_IDS = ["phys-1401", "cs-314"];

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
