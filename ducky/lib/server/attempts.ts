import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isProblemId } from "./assignments";
import { getMisconceptions, getSteps, type ServerSession } from "./store";

/**
 * Records each student's progress on an uploaded problem in `public.sessions` (one row per
 * student and problem, merged forward by `record_attempt` in 0005_teacher_insights.sql) and
 * detected misconceptions in `misconception_events`. Feeds the teacher's Assignments and
 * Transcripts pages.
 *
 * Fire and forget: never awaited by the routes, never throws. Demo sessions aren't recorded
 * (no problem row), and without SUPABASE_SERVICE_ROLE_KEY nothing is.
 */
export function recordAttempt(s: ServerSession, opts: { misconception?: string; evidence?: string } = {}): void {
  if (!isProblemId(s.id)) return;
  const admin = createAdminClient();
  if (!admin) return;

  (async () => {
    const { data: sessionId, error } = await admin.rpc("record_attempt", {
      p_problem: s.id,
      p_student: s.userId,
      p_hints: s.hintsUsed,
      p_steps: s.completedSteps,
      p_steps_total: getSteps(s).length,
      p_revealed: s.revealed,
      p_completed: s.completed,
    });
    if (error) throw new Error(`record_attempt: ${error.message}`);
    if (!opts.misconception || typeof sessionId !== "string") return;

    const label = getMisconceptions(s).find((m) => m.id === opts.misconception)?.label ?? opts.misconception;
    const { error: evErr } = await admin.from("misconception_events").insert({
      session_id: sessionId,
      problem_id: s.id,
      label,
      evidence: (opts.evidence ?? "").slice(0, 500) || label,
    });
    if (evErr) throw new Error(`misconception_events: ${evErr.message}`);
  })().catch((e) => console.error("[recordAttempt]", e));
}
