import { HttpError } from "@/lib/auth";
import { errorStatus, loadOwnSession, readJson } from "@/lib/server/guard";
import { getNote, recordPlay } from "@/lib/server/voiceNotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/voice-notes/play  { sessionId, id }: the student played a note (counts toward "helped"). */
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const s = await loadOwnSession(body.sessionId);
    const note = typeof body.id === "string" ? await getNote(body.id) : null;
    if (!note || note.problemId !== s.id) throw new HttpError(404, "No such note.");
    await recordPlay(note.id, s.userId);
    return Response.json({ ok: true });
  } catch (e) {
    const { status, message } = errorStatus(e);
    return Response.json({ error: message }, { status });
  }
}
