/**
 * Shapes the teacher view reads from Supabase (built in lib/server/classroom.ts).
 * Safe for client components: no solutions leave the server except to the class's teacher.
 */
import type { Policy } from "./types";

export interface TeacherClass {
  id: string;
  name: string;
  courseNumber: string | null;
  joinCode: string;
  students: number;
  problemSets: number;
  createdAt: string;
}

export interface RosterEntry {
  studentId: string;
  name: string;
  email: string;
  joinedAt: string;
}

export interface TeacherProblem {
  id: string;
  position: number;
  prompt: string;
  solution: string;
  steps: string[];
  hints: string[];
  misconceptions: string[];
}

export interface TeacherAssignment {
  id: string;
  title: string;
  published: boolean;
  dueAt: string | null;
  sourceFile: string | null;
  createdAt: string;
  policy: Policy;
  problems: TeacherProblem[];
  /** Lines removed from the upload because they read like instructions to the AI (ASG-5.6). */
  flaggedLines: string[];
}

export interface TeacherClassDetail extends TeacherClass {
  roster: RosterEntry[];
  assignments: TeacherAssignment[];
}

/** "Fri, Oct 30" for a date-only or ISO string; null passes through. */
export function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
