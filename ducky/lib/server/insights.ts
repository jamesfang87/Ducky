import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession, HttpError } from "@/lib/auth";
import type { TeacherClass } from "@/lib/classroom";
import type { AgentTemplate, Attempt, ClassInsights, InsightAssignment, LeakStatus, MisconceptionHit, TeacherSetOption } from "@/lib/insights";
import type { LeakHit } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNMENT_COLUMNS, policyFromRow, sanitizePolicy, type AssignmentRow } from "./assignments";
import { listTeacherClasses } from "./classroom";

/**
 * Teacher reads for the Tutor agents, Assignments and Transcripts pages. Every query runs on
 * the teacher's own client, so RLS limits it to their classes and their students' sessions.
 */

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

const LEAK_STATUSES: LeakStatus[] = ["unchecked", "clean", "leaked", "mutated"];

export function readLeakHits(raw: unknown): LeakHit[] {
  return (Array.isArray(raw) ? raw : []).filter(
    (h): h is LeakHit => !!h && typeof h.domain === "string" && typeof h.title === "string" && typeof h.match === "number" && typeof h.url === "string",
  );
}

interface ProblemRow {
  id: string;
  position: number;
  prompt: string;
  concepts: string[] | null;
  leak_status: string;
  leak_hits: unknown;
  leak_checked_at: string | null;
}

/** Thrown when 0005_teacher_insights.sql hasn't been run, so the page can say so. */
export class MissingMigrationError extends Error {
  constructor() {
    super("Run ducky-backend/supabase/migrations/0005_teacher_insights.sql in Supabase.");
  }
}
const isMissingColumn = (code?: string) => code === "42703" || code === "PGRST204" || code === "42P01" || code === "PGRST205";

/** Grades, timings and misconceptions for one class. Null if it isn't the caller's. */
export async function getClassInsights(supabase: SupabaseClient, classId: string): Promise<ClassInsights | null> {
  const { data: cls, error } = await supabase
    .from("classes")
    .select("id, name, course_number, enrollments(student_id, profiles(full_name, email))")
    .eq("id", classId)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null; // not a uuid
    throw new Error(`load class: ${error.message}`);
  }
  if (!cls) return null;

  const roster = ((cls.enrollments ?? []) as { student_id: string; profiles: unknown }[])
    .map((e) => {
      const p = one(e.profiles as { full_name: string | null; email: string | null } | null);
      return { studentId: e.student_id, name: p?.full_name || p?.email?.split("@")[0] || "Student" };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const { data: rows, error: asgError } = await supabase
    .from("assignments")
    .select(`${ASSIGNMENT_COLUMNS}, problems(id, position, prompt, concepts, leak_status, leak_hits, leak_checked_at)`)
    .eq("class_id", classId)
    .order("created_at", { ascending: true });
  if (asgError) {
    if (isMissingColumn(asgError.code)) throw new MissingMigrationError();
    throw new Error(`load problem sets: ${asgError.message}`);
  }

  const assignments: InsightAssignment[] = ((rows ?? []) as (AssignmentRow & { problems: ProblemRow[] })[]).map((a) => ({
    id: a.id,
    title: a.title,
    published: a.published,
    dueAt: a.due_at,
    createdAt: a.created_at,
    policy: policyFromRow(a),
    problems: [...(a.problems ?? [])]
      .sort((x, y) => x.position - y.position)
      .map((p) => ({
        id: p.id,
        position: p.position,
        prompt: p.prompt,
        concepts: p.concepts ?? [],
        leak: {
          status: LEAK_STATUSES.includes(p.leak_status as LeakStatus) ? (p.leak_status as LeakStatus) : "unchecked",
          checkedAt: p.leak_checked_at,
          hits: readLeakHits(p.leak_hits),
        },
      })),
  }));

  const problemIds = assignments.flatMap((a) => a.problems.map((p) => p.id));
  const enrolled = new Set(roster.map((r) => r.studentId));
  let attempts: Attempt[] = [];
  let misconceptions: MisconceptionHit[] = [];

  if (problemIds.length && enrolled.size) {
    const [{ data: sess, error: sErr }, { data: mis, error: mErr }] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, problem_id, student_id, status, hints_used, steps_done, steps_total, revealed, active_seconds, started_at")
        .in("problem_id", problemIds),
      supabase.from("misconception_events").select("session_id, problem_id, label, created_at").in("problem_id", problemIds),
    ]);
    if (sErr) {
      if (isMissingColumn(sErr.code)) throw new MissingMigrationError();
      throw new Error(`load attempts: ${sErr.message}`);
    }
    if (mErr) throw new Error(`load misconceptions: ${mErr.message}`);

    // Only enrolled students count; the teacher's own previews are left out.
    const studentOf = new Map<string, string>();
    attempts = (sess ?? [])
      .filter((r) => enrolled.has(r.student_id))
      .map((r) => {
        studentOf.set(r.id, r.student_id);
        return {
          problemId: r.problem_id,
          studentId: r.student_id,
          hintsUsed: r.hints_used ?? 0,
          stepsDone: Array.isArray(r.steps_done) ? r.steps_done.length : 0,
          stepsTotal: r.steps_total ?? 0,
          revealed: !!r.revealed,
          completed: r.status === "completed",
          activeSeconds: r.active_seconds ?? 0,
          startedAt: r.started_at,
        };
      });
    misconceptions = (mis ?? []).flatMap((m) => {
      const studentId = studentOf.get(m.session_id);
      return studentId ? [{ problemId: m.problem_id, studentId, label: m.label, at: m.created_at }] : [];
    });
  }

  return { classId: cls.id, className: cls.name, courseNumber: cls.course_number ?? null, roster, assignments, attempts, misconceptions };
}


export async function listTemplates(supabase: SupabaseClient): Promise<AgentTemplate[]> {
  const { data, error } = await supabase.from("agent_templates").select("id, name, description, policy, updated_at").order("created_at");
  if (error) {
    if (isMissingColumn(error.code)) throw new MissingMigrationError();
    throw new Error(`list templates: ${error.message}`);
  }
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, description: t.description ?? "", policy: sanitizePolicy(t.policy), updatedAt: t.updated_at }));
}

/** Name (required) and description from a request body. Shared by the templates routes. */
export function readTemplateText(body: Record<string, unknown>, partial: boolean): { name?: string; description?: string } {
  const out: { name?: string; description?: string } = {};
  if (body.name !== undefined || !partial) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80) throw new HttpError(400, "Give the agent a name (up to 80 characters).");
    out.name = name;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.length > 300) throw new HttpError(400, "Description is up to 300 characters.");
    out.description = body.description.trim();
  }
  return out;
}


/** Every problem set across the teacher's classes, for "apply template to…". */
export async function listTeacherSets(supabase: SupabaseClient): Promise<TeacherSetOption[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select(`${ASSIGNMENT_COLUMNS}, classes(name, course_number)`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`list sets: ${error.message}`);
  return ((data ?? []) as (AssignmentRow & { classes: unknown })[]).map((a) => {
    const c = one(a.classes as { name: string; course_number: string | null } | null);
    return { id: a.id, title: a.title, className: c?.course_number || c?.name || "Class", policy: policyFromRow(a) };
  });
}

export type ClassPageData =
  | { status: "ok"; classes: TeacherClass[]; insights: ClassInsights; recording: boolean }
  | { status: "no_classes" }
  | { status: "error"; message: string };

/** The teacher's classes and insights for the chosen one (?class=, else the newest). Shared by Assignments and Transcripts. */
export async function loadClassPage(classParam: string | string[] | undefined): Promise<ClassPageData> {
  const session = await getSession(); // the layout already required a teacher
  if (!session) return { status: "no_classes" };
  const supabase = await createClient();
  try {
    const classes = await listTeacherClasses(supabase, session.userId);
    if (!classes.length) return { status: "no_classes" };
    const wanted = typeof classParam === "string" ? classParam : undefined;
    const cls = classes.find((c) => c.id === wanted) ?? classes[0];
    const insights = await getClassInsights(supabase, cls.id);
    if (!insights) return { status: "no_classes" };
    // Without the service role the tutor can't record attempts, so the pages say why they're empty.
    return { status: "ok", classes, insights, recording: createAdminClient() !== null };
  } catch (e) {
    if (e instanceof MissingMigrationError) return { status: "error", message: e.message };
    throw e;
  }
}
