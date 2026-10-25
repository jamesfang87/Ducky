"use client";

import { useEffect, useRef, useState } from "react";
import { DuckyRadio as Engine } from "@/lib/radio";
import { usePersistedState } from "@/lib/usePersistedState";

type Source = "spotify" | "adaptive";

const PRESETS = [
  { label: "lofi beats", id: "playlist/37i9dQZF1DWWQRwui0ExPn" },
  { label: "lofi chill", id: "playlist/37i9dQZF1DWYoYGBbGKurt" },
];

/** Accepts any open.spotify.com playlist, album, track or show link and returns its embed path. */
function parseSpotify(link: string): string | null {
  const m = link.trim().match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track|episode|show)\/([A-Za-z0-9]+)/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * Study music in the session header. "Spotify" embeds a real lofi playlist (or any link you paste).
 * "Adaptive" is Ducky's own generated track: layers join as steps are explained, and it softens
 * while a misconception is open.
 */
export function DuckyRadioButton({ progress, tension, done }: { progress: number; tension: boolean; done: boolean }) {
  const engine = useRef<Engine | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [source, setSource] = usePersistedState<Source>("ducky:radioSource", "spotify");
  const [embed, setEmbed] = usePersistedState("ducky:radioEmbed", PRESETS[0].id);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState(false);
  const [adaptiveOn, setAdaptiveOn] = useState(false);
  // Mount the Spotify frame only after the panel is first opened, then keep it so music survives closing the panel.
  const [spotifyMounted, setSpotifyMounted] = useState(false);

  useEffect(() => {
    engine.current?.set({ progress, tension, done });
  }, [progress, tension, done]);

  useEffect(() => () => engine.current?.stop(), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggleAdaptive() {
    if (!engine.current) engine.current = new Engine();
    if (adaptiveOn) {
      engine.current.stop();
      setAdaptiveOn(false);
      return;
    }
    engine.current.set({ progress, tension, done });
    try {
      await engine.current.start();
      setAdaptiveOn(true);
    } catch {
      setAdaptiveOn(false);
    }
  }

  function pickSource(next: Source) {
    setSource(next);
    if (next === "spotify" && adaptiveOn) {
      engine.current?.stop();
      setAdaptiveOn(false);
    }
  }

  function submitLink(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseSpotify(link);
    setLinkError(!parsed);
    if (parsed) {
      setEmbed(parsed);
      setLink("");
    }
  }

  const mood = done
    ? "Resolved"
    : tension
      ? "Soft focus"
      : progress >= 0.75
        ? "Full band"
        : progress >= 0.5
          ? "Drums in"
          : progress >= 0.25
            ? "Bass in"
            : "Warming up";
  const playing = adaptiveOn;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (source === "spotify") setSpotifyMounted(true);
        }}
        aria-expanded={open}
        title="Study music"
        className={`flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition ${
          playing ? "border-accent bg-accent-tint text-accent" : "border-line bg-surface text-sub hover:text-ink"
        }`}
      >
        <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`w-[3px] rounded-sm bg-current ${playing ? "animate-bar" : ""}`}
              style={{ height: playing ? "100%" : `${[40, 70, 50][i]}%`, animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        Radio
      </button>

      {/* Hidden, not unmounted, so the Spotify player keeps playing when the panel closes. */}
      <div
        className={`absolute right-0 z-50 mt-2 w-[min(380px,92vw)] rounded-2xl border border-line bg-surface p-3 shadow-xl ${open ? "" : "hidden"}`}
        role="dialog"
        aria-label="Study music"
      >
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-ground p-1 text-[13px] font-medium">
          {(
            [
              ["spotify", "Spotify lofi"],
              ["adaptive", "Adaptive"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                pickSource(id);
                if (id === "spotify") setSpotifyMounted(true);
              }}
              className={`rounded-lg px-3 py-1.5 transition ${source === id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={source === "spotify" ? "" : "hidden"}>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setEmbed(p.id)}
                className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
                  embed === p.id ? "border-accent bg-accent-tint text-accent" : "border-line text-sub hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {spotifyMounted && (
            <iframe
              title="Spotify player"
              src={`https://open.spotify.com/embed/${embed}?utm_source=generator`}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded-xl"
            />
          )}
          <form onSubmit={submitLink} className="mt-2 flex gap-2">
            <input
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setLinkError(false);
              }}
              placeholder="Paste any Spotify link"
              aria-label="Spotify link"
              className="h-9 min-w-0 flex-1 rounded-lg border border-line px-3 text-[13px]"
            />
            <button type="submit" className="btn h-9 px-3 text-[13px]">
              Play
            </button>
          </form>
          {linkError && <p className="mt-1 text-[12px] text-warn">That doesn’t look like a Spotify playlist, album or track link.</p>}
          <p className="mt-2 text-[12px] leading-snug text-muted">Sign in to Spotify in this browser to hear full tracks. Otherwise you get previews.</p>
        </div>

        <div className={source === "adaptive" ? "" : "hidden"}>
          <p className="text-[13px] leading-snug text-sub">
            A calm, generated lofi loop that follows your reasoning. Each step you explain adds an instrument. If Ducky flags a
            misconception, it softens and waits. Finish the problem and it resolves.
          </p>
          <button type="button" onClick={toggleAdaptive} className={`mt-3 w-full ${adaptiveOn ? "btn" : "btn-primary"}`}>
            {adaptiveOn ? "Stop" : "Play adaptive lofi"}
          </button>
          {adaptiveOn && <p className="mt-2 text-center text-[12px] text-muted">Now: {mood}</p>}
        </div>
      </div>
    </div>
  );
}
