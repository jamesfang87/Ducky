import { HttpError } from "@/lib/auth";
import { errorStatus, readJson, requireTutorUser } from "@/lib/server/guard";
import { MAX_CHARS, speak, SpeakNotConfigured } from "@/lib/server/speak";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/speak   body: { text }
 *   200 audio/mpeg   Ducky saying the text (ElevenLabs)
 *   503              voice not configured; the browser falls back to its own voice
 */
export async function POST(req: Request) {
  try {
    await requireTutorUser();
    const { text } = await readJson(req);
    if (typeof text !== "string" || !text.trim()) throw new HttpError(400, "Nothing to say.");
    if (text.length > MAX_CHARS) throw new HttpError(413, "That reply is too long to speak.");

    const audio = await speak(text.trim());
    return new Response(audio, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof SpeakNotConfigured) return Response.json({ error: "Ducky's voice isn't configured on the server." }, { status: 503 });
    const { status, message } = errorStatus(e);
    if (status === 500) {
      return Response.json({ error: "Couldn't generate Ducky's voice." }, { status: 502 });
    }
    return Response.json({ error: message }, { status });
  }
}
