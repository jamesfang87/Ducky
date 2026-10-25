import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/auth";
import { DEFAULT_POLICY } from "@/lib/mock";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Policy, Tone } from "@/lib/types";
import type { ServerMisconception, Template } from "./store";

/**
 * Teacher-uploaded problem sets, stored in Supabase:
 *   assignments        title, due date, published, and the policy (POL-1 columns + `policy` jsonb)
 *   problems           the prompt and predicted misconceptions (students may read these once published)
 *   problem_solutions  solution + `rubric` jsonb holding steps, hints, opening line and final answers
 *                      (teacher-only under RLS; the tutor reads it with the service role)
 */

export const MAX_HINTS = 10;
export const MAX_HINT_PENALTY = 50;
const TONES: Tone[] = ["Socratic", "Encouraging", "Exam-style"];

/** What a problem set's `problem_solutions.rubric` holds. */
export interface TutorMaterial {
  steps: string[];
  hints: string[];
  opening: string;
  finalAnswers: string[];
}

export interface AssignmentRow {
  id: string;
  class_id: string;
  title: string;
  hint_limit: number;
  reveal_answers: boolean;
  voice_required: boolean;
  policy: Record<string, unknown> | null;
  published: boolean;
  due_at: string | null;
  source_file: string | null;
  created_at: string;
}

export const ASSIGNMENT_COLUMNS = "id, class_id, title, hint_limit, reveal_answers, voice_required, policy, published, due_at, source_file, created_at";

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

/**
 * Coerce untrusted input (a request body or a stored row) into a valid policy.
 * There is deliberately no jailbreak-shield field: the server always applies it.
 */
export function sanitizePolicy(input: unknown): Policy {
  const p = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const tools = (p.tools && typeof p.tools === "object" ? p.tools : {}) as Record<string, unknown>;
  const guardrails = (p.guardrails && typeof p.guardrails === "object" ? p.guardrails : {}) as Record<string, unknown>;
  const hints = Number(p.hintLimit);
  const penalty = Number(p.hintPenalty);
  return {
    hintLimit: Number.isFinite(hints) ? Math.min(MAX_HINTS, Math.max(0, Math.round(hints))) : DEFAULT_POLICY.hintLimit,
    hintPenalty: Number.isFinite(penalty) ? Math.min(MAX_HINT_PENALTY, Math.max(0, Math.round(penalty))) : DEFAULT_POLICY.hintPenalty,
    revealAnswers: bool(p.revealAnswers, DEFAULT_POLICY.revealAnswers),
    revealAfterHints: bool(p.revealAfterHints, DEFAULT_POLICY.revealAfterHints),
    voiceRequired: bool(p.voiceRequired, DEFAULT_POLICY.voiceRequired),
    tone: TONES.includes(p.tone as Tone) ? (p.tone as Tone) : DEFAULT_POLICY.tone,
    tools: {
      visualizations: bool(tools.visualizations, DEFAULT_POLICY.tools.visualizations),
      webExamples: bool(tools.webExamples, DEFAULT_POLICY.tools.webExamples),
      calculator: bool(tools.calculator, DEFAULT_POLICY.tools.calculator),
    },
    guardrails: { stayOnAssignment: bool(guardrails.stayOnAssignment, DEFAULT_POLICY.guardrails.stayOnAssignment) },
  };
}

export function policyFromRow(row: Pick<AssignmentRow, "hint_limit" | "reveal_answers" | "voice_required" | "policy">): Policy {
  return sanitizePolicy({
    ...(row.policy ?? {}),
    hintLimit: row.hint_limit,
    revealAnswers: row.reveal_answers,
    voiceRequired: row.voice_required,
  });
}

export function policyToRow(p: Policy) {
  return {
    hint_limit: p.hintLimit,
    reveal_answers: p.revealAnswers,
    voice_required: p.voiceRequired,
    policy: { hintPenalty: p.hintPenalty, revealAfterHints: p.revealAfterHints, tone: p.tone, tools: p.tools, guardrails: p.guardrails },
  };
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Spoken sentences matching these leak the answer. Very short answers ("4") would match everything, so they're skipped. */
function answerPatterns(finalAnswers: string[]): RegExp[] {
  return finalAnswers
    .map((a) => a.trim())
    .filter((a) => a.replace(/\s/g, "").length >= 3)
    .map((a) => new RegExp(escapeRegex(a).replace(/\s+/g, "\\s*"), "i"));
}

export function readMaterial(raw: unknown): TutorMaterial {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);
  return {
    steps: strings(r.steps),
    hints: strings(r.hints),
    opening: typeof r.opening === "string" ? r.opening : "",
    finalAnswers: strings(r.finalAnswers),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isProblemId = (id: string) => UUID.test(id);

interface ProblemJoin {
  id: string;
  position: number;
  prompt: string;
  predicted_misconceptions: unknown;
  assignments: AssignmentRow & { classes: { name: string; course_number?: string | null } | null };
}

/**
 * Build the tutor template for one uploaded problem (session id = problem id).
 *
 * Access is checked with the caller's own client first: RLS only returns the
 * problem to its teacher, or to an enrolled student once the set is published.
 * Only then is the solution read, with the service role if the caller can't
 * read it themselves (students never can, GRD-1).
 */
export async function loadUploadedTemplate(supabase: SupabaseClient, problemId: string): Promise<Template | null> {
  if (!isProblemId(problemId)) return null;
  const { data, error } = await supabase
    .from("problems")
    .select(`id, position, prompt, predicted_misconceptions, assignments!inner(${ASSIGNMENT_COLUMNS}, classes!inner(*))`)
    .eq("id", problemId)
    .maybeSingle<ProblemJoin>();
  if (error) throw new Error(`load problem: ${error.message}`);
  if (!data) return null;
  const asg = data.assignments;

  const { data: siblings } = await supabase
    .from("problems")
    .select("id, position")
    .eq("assignment_id", asg.id)
    .order("position");
  const order = (siblings ?? []) as { id: string; position: number }[];
  const at = order.findIndex((p) => p.id === data.id);

  let solution = (await supabase.from("problem_solutions").select("solution, rubric").eq("problem_id", data.id).maybeSingle()).data;
  if (!solution) {
    const admin = createAdminClient();
    if (!admin) {
      throw new HttpError(503, "This problem set can't be tutored yet: the server is missing SUPABASE_SERVICE_ROLE_KEY.");
    }
    solution = (await admin.from("problem_solutions").select("solution, rubric").eq("problem_id", data.id).maybeSingle()).data;
  }
  if (!solution) return null;
  const material = readMaterial(solution.rubric);

  const misconceptions: ServerMisconception[] = (Array.isArray(data.predicted_misconceptions) ? data.predicted_misconceptions : [])
    .filter((m): m is ServerMisconception => !!m && typeof m.id === "string" && typeof m.label === "string");

  return {
    problem: {
      index: at + 1,
      total: order.length,
      course: asg.classes?.course_number || asg.classes?.name || "Class",
      set: asg.title,
      prompt: data.prompt,
    },
    policy: policyFromRow(asg),
    solution: { text: solution.solution, finalAnswerPatterns: answerPatterns(material.finalAnswers) },
    misconceptions,
    hints: material.hints.length ? material.hints : ["What is the problem asking for, and what do you already know?"],
    steps: material.steps.length ? material.steps : ["Explain your approach", "Work it through", "Explain why it works"],
    startStep: 0,
    opening: material.opening || "Before we work anything out: what is this problem asking, in your own words?",
    next: order[at + 1]?.id ?? null,
  };
}
