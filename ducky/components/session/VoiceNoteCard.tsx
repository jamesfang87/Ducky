"use client";

import { useEffect, useRef, useState } from "react";
import { recordNotePlay, type VoiceNoteClip } from "@/lib/api";
import { clock } from "@/lib/useRecorder";

/**
 * The part of a teacher's (or classmate's) voice note that covers exactly where this student is
 * stuck. Plays only that segment of the recording, and lists the videos and pages Muse matched
 * to the way they explained it.
 */
export default function VoiceNoteCard({ sessionId, clip, onDismiss }: { sessionId: string; clip: VoiceNoteClip; onDismiss: () => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [showText, setShowText] = useState(false);
  const counted = useRef(false);
  const length = Math.max(1, clip.end - clip.start);
  const teacher = clip.role === "teacher";

  useEffect(() => {
    setPlaying(false);
    setAt(0);
    counted.current = false;
  }, [clip.id, clip.start]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (playing) {
      a.pause();
      return;
    }
    if (a.currentTime < clip.start || a.currentTime >= clip.end - 0.2) a.currentTime = clip.start;
    void a.play().catch(() => setPlaying(false));
    if (!counted.current) {
      counted.current = true;
      void recordNotePlay(sessionId, clip.id).catch(() => {});
    }
  };

  return (
    <div className="card border-accent/50 p-5" role="region" aria-label={teacher ? `Voice note from ${clip.author}` : "Tip from a classmate"}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent/15 text-accent" aria-hidden>
          <MicIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{teacher ? `From ${clip.author}` : `Tip from ${clip.author}, a classmate`}</p>
          <p className="mt-0.5 font-semibold leading-snug">{clip.label}</p>
          <p className="mt-0.5 text-[13px] text-muted">{teacher ? "Recorded for this exact step." : "They were stuck here too. Your teacher approved this."}</p>
        </div>
        <button type="button" onClick={onDismiss} className="-mr-1 text-sm text-muted hover:text-ink" aria-label="Dismiss voice note">
          ×
        </button>
      </div>

      <div className="mt-3.5 flex items-center gap-3">
        <button type="button" onClick={toggle} className="btn-primary h-10 min-w-[96px] px-4 text-sm">
          {playing ? "Pause" : at > 0 ? "Resume" : "Play"}
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${Math.min(100, (at / length) * 100)}%` }} />
        </div>
        <span className="w-[72px] text-right font-mono text-xs text-muted">
          {clock(at)} / {clock(length)}
        </span>
      </div>
      <audio
        ref={audio}
        src={`/api/voice-notes/audio?id=${encodeURIComponent(clip.id)}`}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setAt(Math.max(0, t - clip.start));
          if (t >= clip.end) {
            e.currentTarget.pause();
            setAt(length);
          }
        }}
      />

      <button type="button" className="mt-3 text-[13px] font-semibold text-accent hover:text-accent-dark" onClick={() => setShowText((v) => !v)} aria-expanded={showText}>
        {showText ? "Hide words" : "Read it instead"}
      </button>
      {showText && <p className="mt-1.5 text-sm leading-relaxed text-sub">“{clip.text}”</p>}

      {clip.resources.length > 0 && (
        <div className="mt-3.5 border-t border-line pt-3">
          <p className="text-[13px] font-semibold">Explains it the same way</p>
          <ul className="mt-1.5 flex flex-col gap-2">
            {clip.resources.map((r) => (
              <li key={r.link}>
                <a href={r.link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent no-underline hover:text-accent-dark">
                  {r.title}
                </a>
                <p className="text-[12px] text-muted">
                  {r.kind === "video" ? `Video${r.length ? ` · ${r.length}` : ""}` : "Page"} · {r.source}
                </p>
                {r.why && <p className="text-[13px] text-sub">{r.why}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">Found with SerpApi, matched to the note by Muse.</p>
        </div>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
    </svg>
  );
}
