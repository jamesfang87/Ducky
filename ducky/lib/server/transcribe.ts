import "server-only";

/**
 * Muse Voice Transcribe, file mode (POST /v1/asr/transcribe). The browser records
 * one answer, encodes it as 16 kHz mono 16-bit WAV, and sends it here when the
 * student taps stop. $0.18 per audio hour, billed to the same Meta account.
 */

export const TRANSCRIBE_SAMPLE_RATE = 16_000;
export const MAX_SECONDS = 60;
// 44-byte WAV header + 2 bytes per sample, plus a little slack.
export const MAX_BYTES = 44 + TRANSCRIBE_SAMPLE_RATE * 2 * MAX_SECONDS + 1024;

/** Checks the header is the WAV format Muse accepts. Returns a problem, or null if fine. */
export function checkWav(buf: Buffer): string | null {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return "Audio must be a WAV file.";
  const channels = buf.readUInt16LE(22);
  const rate = buf.readUInt32LE(24);
  const bits = buf.readUInt16LE(34);
  if (channels !== 1 || bits !== 16 || (rate !== 16_000 && rate !== 24_000)) return "Audio must be mono 16-bit WAV at 16 or 24 kHz.";
  return null;
}

export async function transcribe(wav: Buffer): Promise<string> {
  const key = process.env.META_API_KEY;
  if (!key) throw new Error("META_API_KEY is not set");
  const base = (process.env.META_BASE_URL || "https://api.meta.ai/v1").replace(/\/$/, "");

  const form = new FormData();
  form.append(
    "request",
    new Blob(
      [
        JSON.stringify({
          model: process.env.META_TRANSCRIBE_MODEL || "muse-voice-transcribe-1.0",
          audioEncoding: "WAV",
          sampleRateHertz: wav.readUInt32LE(24),
        }),
      ],
      { type: "application/json" },
    ),
  );
  form.append("audio", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "answer.wav");

  const res = await fetch(`${base}/asr/transcribe`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await res.json().catch(() => ({}))) as { transcript?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(`transcribe ${res.status}: ${json.error?.message ?? "unknown error"}`);
  // Muse sometimes doubles the final period ("first..").
  return (json.transcript ?? "").replace(/\.{2}$/, ".").trim();
}
