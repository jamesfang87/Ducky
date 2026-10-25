import { HttpError } from "@/lib/auth";
import { errorStatus, requireTutorUser } from "@/lib/server/guard";
import { checkWav, MAX_BYTES, transcribe } from "@/lib/server/transcribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/transcribe   body: audio/wav (16 kHz mono 16-bit, at most 60 s)
 *   200 { text }
 * Voice input that doesn't depend on the browser's speech service.
 */
export async function POST(req: Request) {
  try {
    await requireTutorUser();
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) throw new HttpError(413, "That recording is too long. Keep answers under a minute.");
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new HttpError(413, "That recording is too long. Keep answers under a minute.");
    const problem = checkWav(buf);
    if (problem) throw new HttpError(400, problem);

    const text = await transcribe(buf);
    return Response.json({ text });
  } catch (e) {
    const { status, message } = errorStatus(e);
    if (status === 500) {
      const detail = e instanceof Error ? e.message : "";
      return Response.json(
        { error: /META_API_KEY is not set/.test(detail) ? "Voice isn't configured on the server (META_API_KEY is not set)." : "Couldn't transcribe that. Try again, or type it." },
        { status: 502 },
      );
    }
    return Response.json({ error: message }, { status });
  }
}
