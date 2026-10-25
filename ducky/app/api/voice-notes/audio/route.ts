import { getSession } from "@/lib/auth";
import { getNote, loadAudio } from "@/lib/server/voiceNotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/voice-notes/audio?id=…
 * The note's recording. Live notes play for anyone signed in to their class (or the demo sets);
 * pending ones only for teachers. Supports Range so the player can jump to a segment.
 */
export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return new Response("Sign in first.", { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const note = await getNote(id);
  const allowed =
    !!note && (user.role === "teacher" || note.author.userId === user.userId || (note.status === "live" && (note.scope === "demo" || user.classIds.includes(note.scope))));
  if (!note || !allowed) return new Response("Not found.", { status: 404 });
  const wav = await loadAudio(note.id);
  if (!wav) return new Response("Audio is missing.", { status: 404 });

  const headers = { "content-type": "audio/wav", "accept-ranges": "bytes", "cache-control": "private, max-age=3600" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, wav.length - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(wav.length - 1, Number(range[2])) : wav.length - 1;
    if (start >= wav.length || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${wav.length}` } });
    return new Response(new Uint8Array(wav.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${wav.length}`, "content-length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(wav), { headers: { ...headers, "content-length": String(wav.length) } });
}
