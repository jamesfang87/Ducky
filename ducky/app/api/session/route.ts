import { recordAttempt } from "@/lib/server/attempts";
import { errorStatus, loadOwnSession } from "@/lib/server/guard";
import { canReveal, getMisconceptions, getNextSessionId, getOpening, getPolicy, getProblem, getSteps } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/session?sessionId=demo
 * What the session page needs to render. Never includes the solution or hints.
 */
export async function GET(req: Request) {
  try {
    const s = await loadOwnSession(new URL(req.url).searchParams.get("sessionId"));
    const policy = getPolicy(s);
    recordAttempt(s); // opening the problem starts the attempt
    return Response.json({
      problem: getProblem(s),
      opening: getOpening(s),
      steps: getSteps(s),
      currentStep: s.currentStep,
      completedSteps: s.completedSteps,
      misconceptions: getMisconceptions(s),
      hintsUsed: s.hintsUsed,
      hintLimit: policy.hintLimit,
      voiceRequired: policy.voiceRequired,
      revealAfterHints: policy.revealAfterHints,
      stayOnAssignment: policy.guardrails.stayOnAssignment,
      visualsEnabled: policy.tools.visualizations,
      resourcesEnabled: policy.tools.webExamples,
      canReveal: canReveal(s),
      revealed: s.revealed,
      completed: s.completed,
      stepWhenHintsRanOut: s.stepWhenHintsRanOut,
      nextSessionId: getNextSessionId(s),
    });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
