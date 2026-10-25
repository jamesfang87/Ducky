import { HttpError } from "@/lib/auth";
import { loadOwnSession } from "@/lib/server/guard";
import { noteError } from "@/lib/server/noteError";
import { noteScopeOf, templateFor } from "@/lib/server/store";
import { MAX_BYTES } from "@/lib/server/transcribe";
import { createNote, listNotes } from "@/lib/server/voiceNotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/voice-notes/tip?sessionId=…   body: audio/wav (≤ 45 s)
 * "Pass it on": a student who worked through a step records how it clicked for them. Muse maps
 * it to the step or misconception and checks it doesn't give the answer away; it reaches
 * classmates only after the teacher approves it.
 */
export async function POST(req: Request) {
  try {
    const s = await loadOwnSession(new URL(req.url).searchParams.get("sessionId"));
    if (!s.completedSteps.length) throw new HttpError(403, "Finish a step first, then pass on what made it click.");
    const mine = (await listNotes()).filter((n) => n.problemId === s.id && n.author.userId === s.userId);
    if (mine.length >= 2) throw new HttpError(429, "You've already left two tips on this problem. Thanks!");
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) throw new HttpError(413, "Keep tips under 45 seconds.");
    const wav = Buffer.from(await req.arrayBuffer());
    if (wav.length > MAX_BYTES) throw new HttpError(413, "Keep tips under 45 seconds.");
    const note = await createNote({
      wav,
      template: templateFor(s.id)!,
      problemId: s.id,
      scope: noteScopeOf(s),
      author: { userId: s.userId, name: s.student.split(" ")[0] || "A classmate", role: "student" },
    });
    return Response.json({ id: note.id, title: note.title, summary: note.summary });
  } catch (e) {
    return noteError(e);
  }
}
