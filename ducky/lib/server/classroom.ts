import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/auth";
import type { ClassRecord, ClassTone } from "@/lib/classes";
import { formatDay, type RosterEntry, type TeacherAssignment, type TeacherClass, type TeacherClassDetail } from "@/lib/classroom";
import type { ProblemSetRecord } from "@/lib/problemSets";
import { ASSIGNMENT_COLUMNS, policyFromRow, readMaterial, type AssignmentRow } from "./assignments";

/**
 * Supabase reads for classes and problem sets. Every query runs on the caller's
 * own client, so RLS decides what they see: teachers only their classes,
 * students only classes they joined and sets that are published.
 */

interface ClassRow {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
  course_number?: string | null;
  teacher_name?: string | null;
}

const count = (v: unknown) => (Array.isArray(v) ? ((v[0] as { count?: number } | undefined)?.count ?? 0) : 0);
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function toTeacherClass(row: ClassRow & { enrollments?: unknown; assignments?: unknown }): TeacherClass {
  return {
    id: row.id,
    name: row.name,
    courseNumber: row.course_number ?? null,
    joinCode: row.join_code,
    students: count(row.enrollments),
    problemSets: count(row.assignments),
    createdAt: row.created_at,
  };
}

export async function listTeacherClasses(supabase: SupabaseClient, teacherId: string): Promise<TeacherClass[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("*, enrollments(count), assignments(count)")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`list classes: ${error.message}`);
  return (data ?? []).map(toTeacherClass);
}

interface ProblemRow {
  id: string;
  position: number;
  prompt: string;
  predicted_misconceptions: unknown;
  flagged_lines: unknown;
  problem_solutions: { solution: string; rubric: unknown } | { solution: string; rubric: unknown }[] | null;
}

function toTeacherAssignment(row: AssignmentRow & { problems?: ProblemRow[] }): TeacherAssignment {
  const problems = [...(row.problems ?? [])].sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    title: row.title,
    published: row.published,
    dueAt: row.due_at,
    sourceFile: row.source_file,
    createdAt: row.created_at,
    policy: policyFromRow(row),
    flaggedLines: problems.flatMap((p) => (Array.isArray(p.flagged_lines) ? p.flagged_lines.filter((l): l is string => typeof l === "string") : [])),
    problems: problems.map((p) => {
      const sol = one(p.problem_solutions);
      const material = readMaterial(sol?.rubric);
      return {
        id: p.id,
        position: p.position,
        prompt: p.prompt,
        solution: sol?.solution ?? "",
        steps: material.steps,
        hints: material.hints,
        misconceptions: (Array.isArray(p.predicted_misconceptions) ? p.predicted_misconceptions : [])
          .map((m) => (m as { label?: unknown })?.label)
          .filter((l): l is string => typeof l === "string"),
      };
    }),
  };
}

/** One class with its roster and every problem set (drafts included). Null if it isn't the caller's. */
export async function getTeacherClass(supabase: SupabaseClient, classId: string): Promise<TeacherClassDetail | null> {
  const { data: cls, error } = await supabase
    .from("classes")
    .select("*, enrollments(student_id, joined_at, profiles(full_name, email))")
    .eq("id", classId)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null; // not a uuid
    throw new Error(`load class: ${error.message}`);
  }
  if (!cls) return null;

  const { data: rows, error: asgError } = await supabase
    .from("assignments")
    .select(`${ASSIGNMENT_COLUMNS}, problems(id, position, prompt, predicted_misconceptions, flagged_lines, problem_solutions(solution, rubric))`)
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  if (asgError) throw new Error(`load problem sets: ${asgError.message}`);

  const enrollments = (cls.enrollments ?? []) as {
    student_id: string;
    joined_at: string;
    profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
  }[];
  const roster: RosterEntry[] = enrollments
    .map((e) => {
      const p = one(e.profiles);
      return { studentId: e.student_id, name: p?.full_name || p?.email?.split("@")[0] || "Student", email: p?.email ?? "", joinedAt: e.joined_at };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const assignments = ((rows ?? []) as (AssignmentRow & { problems?: ProblemRow[] })[]).map(toTeacherAssignment);
  return { ...toTeacherClass({ ...cls, enrollments: [{ count: roster.length }], assignments: [{ count: assignments.length }] }), roster, assignments };
}

/** Throws 404 unless the assignment belongs to one of the caller's classes (RLS hides everyone else's). */
export async function requireOwnAssignment(supabase: SupabaseClient, id: string): Promise<AssignmentRow> {
  const { data } = await supabase.from("assignments").select(ASSIGNMENT_COLUMNS).eq("id", id).maybeSingle<AssignmentRow>();
  if (!data) throw new HttpError(404, "No such problem set.");
  return data;
}

const TONES: ClassTone[] = ["accent", "blue", "amber"];

/**
 * The student's real (Supabase) classes, with each published set shaped like the
 * demo catalog so the existing cards render them. Progress comes from the
 * student's saved chats: a problem counts once its chat reached "Reasoning complete".
 */
export async function listStudentClasses(supabase: SupabaseClient, studentId: string): Promise<ClassRecord[]> {
  const { data: enrolled, error } = await supabase
    .from("enrollments")
    .select("joined_at, classes(*)")
    .eq("student_id", studentId)
    .order("joined_at", { ascending: false });
  if (error) throw new Error(`list enrollments: ${error.message}`);
  const classes = (enrolled ?? []).map((e) => one(e.classes as ClassRow | ClassRow[] | null)).filter((c): c is ClassRow => !!c);
  if (!classes.length) return [];

  const { data: sets } = await supabase
    .from("assignments")
    .select("id, class_id, title, due_at, created_at, problems(id, position, prompt)")
    .in("class_id", classes.map((c) => c.id))
    .eq("published", true)
    .order("created_at");
  const asgs = (sets ?? []) as { id: string; class_id: string; title: string; due_at: string | null; created_at: string; problems: { id: string; position: number; prompt: string }[] }[];

  const problemIds = asgs.flatMap((a) => a.problems.map((p) => p.id));
  const done = new Set<string>();
  if (problemIds.length) {
    const { data: chats } = await supabase.from("chat_histories").select("session_id, messages").in("session_id", problemIds);
    for (const c of chats ?? []) {
      const msgs = Array.isArray(c.messages) ? (c.messages as { flag?: { label?: string } }[]) : [];
      if (msgs.some((m) => m.flag?.label === "Reasoning complete" || m.flag?.label === "Problem solved")) done.add(c.session_id as string);
    }
  }

  return classes.map((c, i): ClassRecord => {
    const mine = asgs.filter((a) => a.class_id === c.id);
    const problemSets: ProblemSetRecord[] = mine.map((a, n) => {
      const problems = [...a.problems].sort((x, y) => x.position - y.position);
      const first = problems[0]?.prompt.replace(/\s+/g, " ") ?? "";
      return {
        id: a.id,
        classId: c.id,
        number: n + 1,
        title: a.title,
        summary: first.length > 140 ? `${first.slice(0, 137)}…` : first,
        problems: problems.length,
        completed: problems.filter((p) => done.has(p.id)).length,
        due: formatDay(a.due_at),
        posted: formatDay(a.created_at) ?? "",
        sessionIds: problems.map((p) => p.id),
      };
    });
    return {
      id: c.id,
      course: c.course_number || "Class",
      name: c.name,
      teacher: c.teacher_name || "Your teacher",
      term: "Fall 2026",
      joinCode: c.join_code,
      tone: TONES[i % TONES.length],
      sets: problemSets.filter((s) => s.sessionIds.length),
    };
  });
}
