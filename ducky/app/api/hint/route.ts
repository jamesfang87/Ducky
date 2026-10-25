import { errorStatus, loadOwnSession, readJson } from "@/lib/server/guard";
import { canReveal, getHints, getPolicy, incrementHints, saveTurn } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/hint  { sessionId }
 * The hint limit is enforced here, not in the UI (POL-4). Shares one counter with
 * hints the tutor gives mid-conversation in /api/turn.
 */
export async function POST(req: Request) {
  try {
    const s = await loadOwnSession((await readJson(req)).sessionId);
    const { hintLimit } = getPolicy(s);

    if (s.hintsUsed >= hintLimit || s.completed) {
      return Response.json({ hint: null, hintsUsed: s.hintsUsed, hintLimit, canReveal: canReveal(s) });
    }

    const hints = getHints(s);
    const hint = hints[Math.min(s.hintsUsed, hints.length - 1)];
    incrementHints(s);
    saveTurn(s, { role: "tutor", text: `Hint: ${hint}` }); // so the tutor sees it in context
    return Response.json({ hint, hintsUsed: s.hintsUsed, hintLimit, canReveal: canReveal(s) });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
