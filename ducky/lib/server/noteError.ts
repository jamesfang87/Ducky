import "server-only";

import { errorStatus } from "./guard";

/** Shared by the teacher and student upload routes. */
export function noteError(e: unknown): Response {
  const detail = e instanceof Error ? e.message : "";
  if (detail === "bad_wav") return Response.json({ error: "That recording isn't a mono 16-bit WAV." }, { status: 400 });
  if (detail === "too_long") return Response.json({ error: "That recording is too long." }, { status: 413 });
  if (detail === "no_speech") return Response.json({ error: "Muse didn't hear any words in that. Check your mic and try again." }, { status: 422 });
  if (/META_API_KEY is not set/.test(detail)) return Response.json({ error: "Voice isn't configured on the server (META_API_KEY is not set)." }, { status: 503 });
  const { status, message } = errorStatus(e);
  return Response.json({ error: message }, { status });
}
