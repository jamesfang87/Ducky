import "server-only";

/**
 * Ducky's voice via ElevenLabs text-to-speech (POST /v1/text-to-speech/{voice_id}).
 * Returns MP3 audio. The Flash model is the low-latency tier, which matters because
 * Ducky starts talking as soon as a reply lands.
 */

export const MAX_CHARS = 1200;

export class SpeakNotConfigured extends Error {}

export async function speak(text: string): Promise<ArrayBuffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voiceId) throw new SpeakNotConfigured("ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID is not set");

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5",
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`elevenlabs ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.arrayBuffer();
}
