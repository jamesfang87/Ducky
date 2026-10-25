import { HttpError } from "@/lib/auth";
import { errorStatus, loadOwnSession, readJson } from "@/lib/server/guard";
import { getPolicy, saveGuardEvent } from "@/lib/server/store";
import { generateVisual } from "@/lib/server/visual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_VISUALS_PER_SESSION = 12;

/**
 * POST /api/visual  { sessionId, topic }
 * Muse draws a step-through animation of `topic` (only concepts from the current
 * problem). Returns only the approved result; the review loop never leaves the server.
 *   200 { status: "ok", title, frames: [{ svg, caption }] }
 *   200 { status: "declined" | "failed", message }
 */
export async function POST(req: Request) {
  let s;
  try {
    const body = await readJson(req);
    s = await loadOwnSession(body.sessionId);
    const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 300) : "";
    if (topic.length < 3) throw new HttpError(400, "Say what you'd like to see, e.g. \"insertion sort on my array\".");
    if (!getPolicy(s).tools.visualizations) throw new HttpError(403, "Your teacher turned visuals off for this assignment.");
    if (s.visualBusy) throw new HttpError(429, "Still drawing the last one. Give it a few seconds.");
    if (s.visualsMade >= MAX_VISUALS_PER_SESSION) throw new HttpError(429, "That's the most visuals for this problem. Let's talk it through.");

    s.visualBusy = true;
    const result = await generateVisual(s, topic);
    if (result.status === "ok") s.visualsMade += 1;
    else saveGuardEvent(s, { kind: result.status === "declined" ? "visual_declined" : "visual_failed", excerpt: topic.slice(0, 200) });
    return Response.json(result);
  } catch (e) {
    const { status, message } = errorStatus(e);
    if (status === 500 && /META_API_KEY is not set/.test(e instanceof Error ? e.message : "")) {
      return Response.json({ error: "The visual model isn't configured on the server (META_API_KEY is not set)." }, { status: 503 });
    }
    return Response.json({ error: message }, { status });
  } finally {
    if (s) s.visualBusy = false;
  }
}
