"use client";

/**
 * Voice input. Records the mic, and when the student taps stop, sends one 16 kHz
 * WAV clip to /api/transcribe (Muse Voice Transcribe). That works in any browser
 * and on networks that block Google's speech service.
 *
 * While recording, the browser's own speech recognition (Chrome/Edge) shows live
 * captions when it's reachable. It's best effort: its errors are ignored, and its
 * text is only used if the server transcription fails.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the vendor-prefixed API. */
interface SRResult { isFinal: boolean; 0: { transcript: string } }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SR {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type SRCtor = new () => SR;

const TARGET_RATE = 16_000;
const MAX_SECONDS = 60;
const MIN_SECONDS = 0.4;
/** Loudness (RMS) that counts as speech, and how long a pause ends the turn. */
const VOICE_RMS = 0.02;
const SILENCE_MS = 1_600;

interface Recording {
  stream: MediaStream;
  ctx: AudioContext;
  proc: ScriptProcessorNode;
  chunks: Float32Array[];
  rate: number;
  captions: SR | null;
  timer: ReturnType<typeof setTimeout>;
  startedAt: number;
  lastVoiceAt: number;
  heardVoice: boolean;
  autoStop: boolean;
  monitor: ReturnType<typeof setInterval> | null;
}

/** Average-and-decimate to 16 kHz; good enough for speech. */
export function downsample(input: Float32Array, from: number): Float32Array {
  if (from === TARGET_RATE) return input;
  const ratio = from / TARGET_RATE;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

/** Mono 16-bit PCM WAV. */
export function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

export function useSpeech(onFinal: (text: string, seconds: number) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recording | null>(null);
  const starting = useRef(false);
  const captionFinal = useRef("");
  const captionLive = useRef("");
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => {
    const w = window as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown };
    setSupported(typeof navigator.mediaDevices?.getUserMedia === "function" && Boolean(w.AudioContext || w.webkitAudioContext));
  }, []);

  const startCaptions = (): SR | null => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return null;
    try {
      const sr = new Ctor();
      sr.lang = "en-US";
      sr.continuous = true;
      sr.interimResults = true;
      sr.onresult = (e) => {
        let live = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) captionFinal.current += r[0].transcript + " ";
          else live += r[0].transcript;
        }
        captionLive.current = (captionFinal.current + live).trim();
        setInterim(captionLive.current);
      };
      sr.onerror = () => {}; // e.g. "network": captions are optional
      sr.start();
      return sr;
    } catch {
      return null;
    }
  };

  /** Stop recording. `send` transcribes and hands the text to the caller; false discards it. */
  const finish = useCallback(async (send: boolean) => {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    clearTimeout(r.timer);
    if (r.monitor) clearInterval(r.monitor);
    r.proc.disconnect();
    r.stream.getTracks().forEach((t) => t.stop());
    void r.ctx.close();
    try {
      r.captions?.stop();
    } catch {}
    setListening(false);

    if (!send) {
      setInterim("");
      return;
    }

    const secs = (Date.now() - r.startedAt) / 1000;
    const total = r.chunks.reduce((n, c) => n + c.length, 0);
    if (total / r.rate < MIN_SECONDS) {
      setInterim("");
      setError("Didn't catch that. Hold on a moment longer and try again.");
      return;
    }
    const merged = new Float32Array(total);
    let at = 0;
    for (const c of r.chunks) {
      merged.set(c, at);
      at += c.length;
    }

    setTranscribing(true);
    let text = "";
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "content-type": "audio/wav" },
        body: encodeWav(downsample(merged, r.rate), TARGET_RATE),
      });
      const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Couldn't transcribe that. Try again, or type it.");
      text = (body.text ?? "").trim();
      if (!text) setError("Didn't catch any words. Try again a little closer to the mic.");
    } catch (e) {
      // Fall back to the browser's captions if it heard something.
      text = (captionFinal.current.trim() || captionLive.current).trim();
      if (!text) setError(e instanceof Error ? e.message : "Couldn't transcribe that.");
    } finally {
      setTranscribing(false);
      setInterim("");
    }
    if (text) cb.current(text, Math.max(1, Math.round(secs)));
  }, []);

  const stop = useCallback(() => void finish(true), [finish]);
  /** Throw the recording away without sending it. */
  const cancel = useCallback(() => void finish(false), [finish]);

  const start = useCallback(
    async (options?: { autoStop?: boolean }) => {
      if (rec.current || starting.current) return;
      starting.current = true;
      setError(null);
      setInterim("");
      captionFinal.current = "";
      captionLive.current = "";

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      } catch (e) {
        starting.current = false;
        const name = e instanceof DOMException ? e.name : "";
        setError(name === "NotAllowedError" ? "Microphone permission denied" : "Couldn't open the microphone");
        return;
      }

      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctx = (w.AudioContext || w.webkitAudioContext)!;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      // ScriptProcessor is deprecated but works everywhere without a separate worklet file.
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      const autoStop = options?.autoStop ?? false;

      const recObj: Recording = {
        stream,
        ctx,
        proc,
        chunks,
        rate: ctx.sampleRate,
        captions: startCaptions(),
        timer: setTimeout(() => void finish(true), MAX_SECONDS * 1000),
        startedAt: Date.now(),
        lastVoiceAt: Date.now(),
        heardVoice: false,
        autoStop,
        monitor: null,
      };

      proc.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(data));
        if (!recObj.autoStop) return;
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        if (Math.sqrt(sum / data.length) >= VOICE_RMS) {
          recObj.lastVoiceAt = Date.now();
          recObj.heardVoice = true;
        }
      };

      source.connect(proc);
      proc.connect(ctx.destination); // required for Chrome to run the processor; it outputs silence

      if (autoStop) {
        // End the turn after the student stops talking, so the conversation can flow.
        recObj.monitor = setInterval(() => {
          if (rec.current !== recObj) return;
          const now = Date.now();
          const elapsed = now - recObj.startedAt;
          const quiet = now - recObj.lastVoiceAt;
          if (elapsed >= 900 && recObj.heardVoice && quiet >= SILENCE_MS) {
            void finish(true);
          } else if (elapsed >= 12_000 && !recObj.heardVoice) {
            setError("Didn't hear anything. Tap the mic when you're ready.");
            void finish(false);
          }
        }, 150);
      }

      rec.current = recObj;
      starting.current = false;
      setListening(true);
    },
    [finish],
  );

  // Release the mic if the page goes away mid-recording.
  useEffect(
    () => () => {
      const r = rec.current;
      if (!r) return;
      clearTimeout(r.timer);
      if (r.monitor) clearInterval(r.monitor);
      r.stream.getTracks().forEach((t) => t.stop());
      void r.ctx.close();
    },
    [],
  );

  return { supported, listening, transcribing, interim, error, start, stop, cancel };
}
