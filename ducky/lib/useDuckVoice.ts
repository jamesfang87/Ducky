"use client";

/**
 * Ducky's spoken voice. Each new tutor reply goes to /api/speak (ElevenLabs) and
 * plays through Web Audio, so the avatar's beak can follow the real loudness via
 * `level`. If the server has no ElevenLabs key, or a request fails, that reply is
 * spoken with the browser's speechSynthesis instead (raised pitch for a duck-ish
 * sound), and the beak flaps on word boundaries.
 *
 * Only tutor messages that arrive after mount are spoken, so reopening a session
 * doesn't replay the whole history.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { usePersistedState } from "@/lib/usePersistedState";

const PITCH = 1.7; // browser fallback only; 0–2, 1 is the voice's normal pitch
const RATE = 1.08;

/** Prefer a natural-sounding English voice when the browser offers one. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const prefer = [/natural/i, /google us english/i, /aria|jenny|samantha/i, /^en-us$/i];
  for (const re of prefer) {
    const hit = en.find((v) => re.test(v.name) || re.test(v.lang));
    if (hit) return hit;
  }
  return en[0] ?? voices[0] ?? null;
}

export function useDuckVoice(messages: ChatMessage[]) {
  const [supported, setSupported] = useState(false);
  const [muted, setMuted] = usePersistedState("ducky:voiceMuted", false);
  const [speaking, setSpeaking] = useState(false);
  // Counts spoken words (browser voice) so the avatar's beak can open on each one.
  const [wordTick, setWordTick] = useState(0);
  /** Loudness of ElevenLabs audio, 0–1, read every frame by the avatar; -1 when none is playing. */
  const level = useRef(-1);
  const voice = useRef<SpeechSynthesisVoice | null>(null);
  // Ids that existed before this mount, or were already queued.
  const spoken = useRef<Set<string> | null>(null);
  const queue = useRef<string[]>([]);
  const busy = useRef(false);
  // Bumped by stop() so in-flight fetches and loops know to give up.
  const generation = useRef(0);
  // Set once the server says ElevenLabs isn't configured; skip straight to the browser voice.
  const serverOff = useRef(false);
  const audio = useRef<{ ctx: AudioContext; el: HTMLAudioElement; raf: number } | null>(null);

  useEffect(() => {
    setSupported(typeof Audio !== "undefined" || "speechSynthesis" in window);
    if (!("speechSynthesis" in window)) return;
    const load = () => (voice.current = pickVoice(window.speechSynthesis.getVoices()));
    load();
    // Chrome fills the voice list asynchronously.
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const endAudio = () => {
    const a = audio.current;
    if (!a) return;
    audio.current = null;
    cancelAnimationFrame(a.raf);
    a.el.pause();
    URL.revokeObjectURL(a.el.src);
    void a.ctx.close();
    level.current = -1;
  };

  /** Plays MP3 audio, tracking its loudness. Resolves when it ends or is stopped. */
  const playAudio = (blob: Blob, gen: number) =>
    new Promise<void>((resolve) => {
      const el = new Audio(URL.createObjectURL(blob));
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaElementSource(el).connect(analyser);
      analyser.connect(ctx.destination);
      const buf = new Float32Array(analyser.fftSize);
      const meter = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const s of buf) sum += s * s;
        // RMS of speech sits around 0.02–0.2; stretch that to 0–1.
        level.current = Math.min(1, Math.max(0, (Math.sqrt(sum / buf.length) - 0.015) * 6));
        if (audio.current) audio.current.raf = requestAnimationFrame(meter);
      };
      audio.current = { ctx, el, raf: requestAnimationFrame(meter) };
      const done = () => {
        if (audio.current?.el === el) endAudio();
        resolve();
      };
      el.onended = done;
      el.onerror = done;
      el.onpause = done;
      if (gen !== generation.current) return done();
      void ctx.resume();
      el.play().catch(done);
    });

  /** Browser voice. Resolves when the utterance ends or is cancelled. */
  const sayInBrowser = (text: string) =>
    new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      if (voice.current) u.voice = voice.current;
      u.pitch = PITCH;
      u.rate = RATE;
      u.onboundary = (e) => {
        if (e.name === "word") setWordTick((n) => n + 1);
      };
      u.onend = u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });

  const drain = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const gen = generation.current;
    while (queue.current.length && gen === generation.current) {
      const text = queue.current.shift()!;
      setSpeaking(true);
      let played = false;
      if (!serverOff.current) {
        try {
          const res = await fetch("/api/speak", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text }),
          });
          if (res.status === 503) serverOff.current = true;
          if (res.ok && gen === generation.current) {
            await playAudio(await res.blob(), gen);
            played = true;
          }
        } catch {}
      }
      if (!played && gen === generation.current) await sayInBrowser(text);
    }
    // After stop() a newer drain may own the queue; leave its state alone.
    if (gen !== generation.current) return;
    busy.current = false;
    setSpeaking(false);
  }, []);

  const stop = useCallback(() => {
    generation.current++;
    queue.current = [];
    busy.current = false;
    endAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  useEffect(() => {
    if (spoken.current === null) {
      spoken.current = new Set(messages.map((m) => m.id));
      return;
    }
    const fresh = messages.filter((m) => !spoken.current!.has(m.id));
    fresh.forEach((m) => spoken.current!.add(m.id));
    const say = fresh.filter((m) => m.role === "tutor" && m.text.trim());
    if (!supported || muted || say.length === 0) return;
    queue.current.push(...say.map((m) => m.text.trim()));
    void drain();
  }, [messages, supported, muted, drain]);

  useEffect(() => {
    if (muted) stop();
  }, [muted, stop]);

  // Silence Ducky when the page goes away.
  useEffect(() => stop, [stop]);

  return { supported, muted, setMuted, speaking, wordTick, level, stop };
}
