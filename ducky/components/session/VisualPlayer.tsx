"use client";

import { useEffect, useMemo, useState } from "react";

interface Frame {
  svg: string;
  caption: string;
}

const STEP_MS = 2600;

// Frames come from the model, so they render in a fully sandboxed iframe (no scripts,
// no network, its own origin) on top of the server-side sanitizer.
const frameDoc = (svg: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">` +
  `<style>html,body{margin:0;height:100%;background:#fff;overflow:hidden}svg{display:block;width:100%;height:100%}</style></head><body>${svg}</body></html>`;

/** Step-through player for a generated visual explanation. */
export default function VisualPlayer({ title, frames, onClose }: { title: string; frames: Frame[]; onClose?: () => void }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const docs = useMemo(() => frames.map((f) => frameDoc(f.svg)), [frames]);
  const last = frames.length - 1;

  useEffect(() => {
    setI(0);
    setPlaying(true);
  }, [frames]);

  useEffect(() => {
    if (!playing) return;
    if (i >= last) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setI((n) => Math.min(last, n + 1)), STEP_MS);
    return () => clearTimeout(id);
  }, [playing, i, last]);

  const go = (n: number) => {
    setPlaying(false);
    setI(Math.max(0, Math.min(last, n)));
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 px-5 py-4">
        <h2 className="h2">{title}</h2>
        <div className="flex-1" />
        <span className="font-mono text-[13px] text-muted">
          {i + 1} / {frames.length}
        </span>
        {onClose && (
          <button type="button" className="text-sm text-sub transition hover:text-ink" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      <div className="relative aspect-video w-full border-y border-line bg-surface">
        <iframe
          key={i}
          title={`${title}, step ${i + 1} of ${frames.length}`}
          sandbox=""
          srcDoc={docs[i]}
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>

      <p className="min-h-[3.5rem] px-5 pt-3 text-[15px] leading-relaxed" aria-live="polite">
        {frames[i]?.caption}
      </p>

      <div className="flex flex-wrap items-center gap-2 px-5 pb-4 pt-2">
        <button type="button" className="btn h-9 px-3 text-sm" onClick={() => go(i - 1)} disabled={i === 0}>
          ‹ Back
        </button>
        {playing ? (
          <button type="button" className="btn h-9 px-3 text-sm" onClick={() => setPlaying(false)}>
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary h-9 px-3 text-sm"
            onClick={() => {
              if (i >= last) setI(0);
              setPlaying(true);
            }}
          >
            {i >= last ? "Replay" : "Play"}
          </button>
        )}
        <button type="button" className="btn h-9 px-3 text-sm" onClick={() => go(i + 1)} disabled={i === last}>
          Next ›
        </button>
        <div className="ml-auto flex gap-1" aria-hidden="true">
          {frames.map((_, n) => (
            <span key={n} className={`h-1.5 w-4 rounded ${n <= i ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
