import { errorStatus, loadOwnSession, readJson } from "@/lib/server/guard";
import { isPeerOptedIn, raiseHand, setPeerOptIn } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/raise-hand  { sessionId, note?, peerOptIn? }
 * Sends the teacher a packet: where the student is, what they are stuck on and the last few turns.
 * `peerOptIn` alone (no note) only updates whether teachers may suggest this student as a helper.
 */
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const s = await loadOwnSession(body.sessionId);
    if (typeof body.peerOptIn === "boolean") setPeerOptIn(s, body.peerOptIn);
    if (body.raise === true) {
      const e = raiseHand(s, typeof body.note === "string" ? body.note : "");
      return Response.json({ ok: true, id: e.id, peerOptIn: isPeerOptedIn(s.userId) });
    }
    return Response.json({ ok: true, peerOptIn: isPeerOptedIn(s.userId) });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
