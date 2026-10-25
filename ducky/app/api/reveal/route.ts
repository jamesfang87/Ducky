import { errorStatus, loadOwnSession, readJson } from "@/lib/server/guard";
import { getPolicy, getSolution, getSteps, markRevealed, saveRevealEvent, saveTurn } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reveal  { sessionId }
 * After every hint is used, and only if the teacher allows it, the student can view
 * the answer for no credit. Records the step they were stuck on for the
 * misconception tracker. The only route that ever sends the solution (GRD-1 exception).
 */
export async function POST(req: Request) {
  try {
    const s = await loadOwnSession((await readJson(req)).sessionId);
    const policy = getPolicy(s);

    if (!s.revealed) {
      if (s.hintsUsed < policy.hintLimit) {
        return Response.json(
          { error: "hints_remaining", hintsUsed: s.hintsUsed, hintLimit: policy.hintLimit },
          { status: 403 },
        );
      }
      if (!policy.revealAfterHints) {
        return Response.json({ error: "disabled_by_teacher" }, { status: 403 });
      }
      markRevealed(s);
      saveRevealEvent(s, s.stepWhenHintsRanOut ?? s.currentStep);
      saveTurn(s, { role: "tutor", text: "(The student viewed the answer after using every hint. No credit for this problem.)" });
    }

    const index = s.stepWhenHintsRanOut ?? s.currentStep;
    return Response.json({
      answer: getSolution(s).text,
      credit: 0,
      step: { index, label: getSteps(s)[index] ?? "" },
      hintsUsed: s.hintsUsed,
      hintLimit: policy.hintLimit,
    });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
