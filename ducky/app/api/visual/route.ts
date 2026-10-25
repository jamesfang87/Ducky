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
 * problem; off-topic asks get the closest part of the problem). Always returns frames;
 * the review loop and how the frames were made never leave the server.
 *   200 { status: "ok", title, frames: [{ svg, caption }] }
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
    const { title, frames, source, redirected } = await generateVisual(s, topic);
    s.visualsMade += 1;
    if (redirected) saveGuardEvent(s, { kind: "visual_declined", excerpt: topic.slice(0, 200) });
    if (source === "roadmap") saveGuardEvent(s, { kind: "visual_failed", excerpt: topic.slice(0, 200) });
    return Response.json({ status: "ok", title, frames });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  } finally {
    if (s) s.visualBusy = false;
  }
}
