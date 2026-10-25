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
  const spoken = useRef<Map<string, string> | null>(null);
  const queue = useRef<string[]>([]);
  const busy = useRef(false);
  // Bumped by stop() so in-flight fetches and loops know to give up.
  const generation = useRef(0);
  // A message the student interrupted: never speak its later streaming chunks.
  const ignored = useRef<Set<string>>(new Set());
  const latestTutorId = useRef<string | null>(null);
  // The next tutor reply belongs to a turn the student already took over.
  const suppressNext = useRef(false);
  // Set once the server says ElevenLabs isn't configured; skip straight to the browser voice.
  const serverOff = useRef(false);
  const audio = useRef<{ el: HTMLAudioElement; raf: number } | null>(null);

  useEffect(() => {
    setSupported(typeof Audio !== "undefined" || "speechSynthesis" in window);
    if (!("speechSynthesis" in window)) return;
    const load = () => (voice.current = pickVoice(window.speechSynthesis.getVoices()));
    load();
    // Chrome fills the voice list asynchronously.
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // One AudioContext for the whole session. Browsers cap how many can exist, and a context made
  // outside a user gesture starts suspended, which would silence anything routed through it.
  const sharedCtx = useRef<AudioContext | null>(null);
  const getCtx = () => (sharedCtx.current ??= new AudioContext());

  // The first tap, click or key press unlocks audio and speech for the rest of the page's life.
  useEffect(() => {
    const unlock = () => {
      try {
        void getCtx().resume();
        if ("speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(" ");
          u.volume = 0;
          window.speechSynthesis.speak(u);
        }
      } catch {}
      for (const ev of ["pointerdown", "keydown", "touchstart"]) window.removeEventListener(ev, unlock);
    };
    for (const ev of ["pointerdown", "keydown", "touchstart"]) window.addEventListener(ev, unlock, { passive: true });
    return () => {
      for (const ev of ["pointerdown", "keydown", "touchstart"]) window.removeEventListener(ev, unlock);
    };
  }, []);

  const endAudio = () => {
    const a = audio.current;
    if (!a) return;
    audio.current = null;
    cancelAnimationFrame(a.raf);
    a.el.pause();
    URL.revokeObjectURL(a.el.src);
    level.current = -1;
  };

  /**
   * Plays MP3 audio, tracking its loudness. Resolves true when it played (or was stopped on purpose),
   * false when playback failed, so the caller can fall back to the browser voice instead of staying silent.
   */
  const playAudio = (blob: Blob, gen: number) =>
    new Promise<boolean>((resolve) => {
      const el = new Audio(URL.createObjectURL(blob));
      let settled = false;
      let watchdog = 0;
      const settle = (ok: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(watchdog);
        if (audio.current?.el === el) endAudio();
        else URL.revokeObjectURL(el.src);
        resolve(ok);
      };
      // Never hang the queue: if nothing finishes in 45 s, give up and let the fallback speak.
      watchdog = window.setTimeout(() => settle(false), 45_000);

      void (async () => {
        const ctx = getCtx();
        try {
          if (ctx.state !== "running") await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 400))]);
        } catch {}
        if (gen !== generation.current) return settle(true);

        let raf = 0;
        // Only route through Web Audio when it is actually running, or the element would go silent.
        if (ctx.state === "running") {
          try {
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            ctx.createMediaElementSource(el).connect(analyser);
            analyser.connect(ctx.destination);
            const buf = new Float32Array(analyser.fftSize);
            const meter = () => {
              analyser.getFloatTimeDomainData(buf);
              let sum = 0;
              for (const v of buf) sum += v * v;
              // RMS of speech sits around 0.02–0.2; stretch that to 0–1.
              level.current = Math.min(1, Math.max(0, (Math.sqrt(sum / buf.length) - 0.015) * 6));
              if (audio.current?.el === el) audio.current.raf = requestAnimationFrame(meter);
            };
            raf = requestAnimationFrame(meter);
          } catch {}
        }
        audio.current = { el, raf };
        el.onended = () => settle(true);
        el.onerror = () => settle(false);
        el.onpause = () => {
          if (!el.ended) settle(gen !== generation.current);
        };
        el.play().catch(() => settle(false));
      })();
    });

  /** Browser voice. Resolves when the utterance ends or is cancelled. */
  const sayInBrowser = (text: string) =>
    new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      if (voice.current) u.voice = voice.current;
      u.pitch = PITCH;
      u.rate = RATE;
      // Chrome sometimes never fires onend (long text, blocked speech). Don't let that wedge the queue.
      const guard = window.setTimeout(resolve, Math.max(4000, text.length * 110));
      const finish = () => {
        window.clearTimeout(guard);
        resolve();
      };
      u.onboundary = (e) => {
        if (e.name === "word") setWordTick((n) => n + 1);
      };
      u.onend = u.onerror = finish;
      window.speechSynthesis.resume();
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
            played = await playAudio(await res.blob(), gen);
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

  const stop = useCallback((options?: { suppressNext?: boolean }) => {
    generation.current++;
    queue.current = [];
    busy.current = false;
    endAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    // If the student cuts Ducky off, don't queue the rest of that same reply.
    if (latestTutorId.current) ignored.current.add(latestTutorId.current);
    // ...or, if Ducky hasn't replied yet, swallow the reply that is still coming.
    if (options?.suppressNext) suppressNext.current = true;
    setSpeaking(false);
  }, []);

  useEffect(() => {
    const lastTutor = [...messages].reverse().find((m) => m.role === "tutor");
    if (lastTutor) latestTutorId.current = lastTutor.id;

    if (spoken.current === null) {
      spoken.current = new Map(messages.map((m) => [m.id, m.text.trim()]));
      return;
    }
    const said = spoken.current;
    const say: string[] = [];
    for (const m of messages) {
      if (m.role !== "tutor") continue;
      const known = said.has(m.id);
      const text = m.text.trim();
      const prev = said.get(m.id) ?? "";
      // A reply that arrived after the student took over the turn stays silent.
      if (!known && suppressNext.current) {
        suppressNext.current = false;
        ignored.current.add(m.id);
      }
      if (text === prev) continue;
      said.set(m.id, text);
      if (ignored.current.has(m.id)) continue;
      // Replies stream in sentence by sentence; speak only the new tail.
      const delta = text.startsWith(prev) ? text.slice(prev.length).trim() : text;
      if (delta) say.push(delta);
    }
    if (!supported || muted || say.length === 0) return;
    queue.current.push(...say);
    void drain();
  }, [messages, supported, muted, drain]);

  useEffect(() => {
    if (muted) stop();
  }, [muted, stop]);

  // Silence Ducky when the page goes away.
  useEffect(() => stop, [stop]);

  return { supported, muted, setMuted, speaking, wordTick, level, stop };
}
