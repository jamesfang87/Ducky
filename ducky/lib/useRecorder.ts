"use client";

/**
 * A longer recording than a chat answer: voice notes (teachers, up to 2 minutes) and tips
 * (students, up to 45 s). Records the mic, shows elapsed time and a level meter, and hands
 * back one 16 kHz mono WAV, the format Muse Voice Transcribe takes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { downsample, encodeWav } from "./useSpeech";

interface Live {
  stream: MediaStream;
  ctx: AudioContext;
  proc: ScriptProcessorNode;
  chunks: Float32Array[];
  rate: number;
  startedAt: number;
  tick: ReturnType<typeof setInterval>;
}

export function useRecorder(maxSeconds: number) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const live = useRef<Live | null>(null);
  const done = useRef<((wav: Blob | null) => void) | null>(null);

  const finish = useCallback((keep: boolean) => {
    const r = live.current;
    if (!r) return;
    live.current = null;
    clearInterval(r.tick);
    r.proc.disconnect();
    r.stream.getTracks().forEach((t) => t.stop());
    void r.ctx.close();
    setRecording(false);
    setLevel(0);
    let wav: Blob | null = null;
    if (keep) {
      const total = r.chunks.reduce((n, c) => n + c.length, 0);
      const all = new Float32Array(total);
      let at = 0;
      for (const c of r.chunks) {
        all.set(c, at);
        at += c.length;
      }
      wav = total / r.rate >= 1 ? encodeWav(downsample(all, r.rate), 16_000) : null;
    }
    done.current?.(wav);
    done.current = null;
  }, []);

  /** Starts recording; the promise resolves with the WAV when `stop()` is called or time runs out. */
  const start = useCallback(async (): Promise<Blob | null> => {
    if (live.current) return null;
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch {
      setError("Allow microphone access to record.");
      return null;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    proc.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(data));
      let sum = 0;
      for (let i = 0; i < data.length; i += 8) sum += data[i] * data[i];
      setLevel(Math.min(1, Math.sqrt(sum / (data.length / 8)) * 6));
    };
    src.connect(proc);
    proc.connect(ctx.destination);
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const s = (Date.now() - startedAt) / 1000;
      setSeconds(s);
      if (s >= maxSeconds) finish(true);
    }, 200);
    live.current = { stream, ctx, proc, chunks, rate: ctx.sampleRate, startedAt, tick };
    setSeconds(0);
    setRecording(true);
    return new Promise((resolve) => (done.current = resolve));
  }, [finish, maxSeconds]);

  useEffect(() => () => finish(false), [finish]);

  return { start, stop: () => finish(true), cancel: () => finish(false), recording, seconds, level, error };
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
