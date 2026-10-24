"use client";

/**
 * Browser speech recognition (Web Speech API) as a stand-in for
 * Muse Voice Transcribe. To swap: stream mic audio via MediaRecorder to
 * your /api/transcribe route and call setInterim/onFinal from its events.
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

export function useSpeech(onFinal: (text: string, seconds: number) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SR | null>(null);
  const finalRef = useRef("");
  const liveRef = useRef("");
  const startedAt = useRef(0);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const start = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    finalRef.current = "";
    setInterim("");
    setError(null);
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript + " ";
        else live += r[0].transcript;
      }
      liveRef.current = (finalRef.current + live).trim();
      setInterim(liveRef.current);
    };
    rec.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone permission denied" : e.error);
    rec.onend = () => {
      setListening(false);
      const text = finalRef.current.trim() || liveRef.current;
      liveRef.current = "";
      const secs = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
      setInterim("");
      if (text) cb.current(text, secs);
    };
    recRef.current = rec;
    startedAt.current = Date.now();
    rec.start();
    setListening(true);
  }, []);

  const stop = useCallback(() => recRef.current?.stop(), []);

  return { supported, listening, interim, error, start, stop };
}
