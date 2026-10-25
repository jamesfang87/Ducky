"use client";

/**
 * Ducky's face. The picture is one still render (public/ducky-avatar.png), so the
 * beak "talks" by sliding a clipped copy of the lower bill down over a dark mouth.
 * Coordinates are in the 512 px image's own pixels, traced from the render.
 *
 * speechSynthesis gives no audio stream to measure, so while Ducky is speaking the
 * beak flaps in a syllable-like rhythm, and word-boundary events (when the voice
 * sends them) snap it open on each word.
 */
import { useEffect, useId, useRef } from "react";

const SRC = "/ducky-avatar.png";
const MAX_DROP = 12; // px in image space the lower bill drops when fully open

/** Where the bills meet, left to right. */
const CREASE: [number, number][] = [
  [202, 242], [215, 241], [228, 239.5], [240, 237], [250, 234.5], [263, 232.5],
  [278, 233.5], [292, 236], [305, 239.5], [320, 240], [333, 238],
];
/** Bottom edge of the lower bill, right to left. */
const CHIN: [number, number][] = [
  [330, 242], [318, 248], [302, 254.5], [285, 259], [265, 261], [245, 260], [225, 256.5], [210, 251], [201, 245],
];

const pts = (p: [number, number][], dy = 0) => p.map(([x, y]) => `${x},${(y + dy).toFixed(1)}`).join(" ");
const JAW = `M${pts(CREASE)} L${pts(CHIN)} Z`;
/** The dark gap between the upper bill and the dropped lower bill; empty when shut so no seam shows. */
const mouth = (drop: number) => (drop < 0.3 ? "" : `M${pts(CREASE)} L${pts([...CREASE].reverse(), drop + 0.5)} Z`);

export type DuckState = "idle" | "listening" | "thinking" | "speaking";

interface Props {
  state: DuckState;
  /** Increments on each spoken word, when the voice reports word boundaries. */
  wordTick?: number;
  /** Live loudness of Ducky's audio, 0–1, or -1 when no measurable audio is playing. */
  level?: React.RefObject<number>;
  size?: number;
}

export default function DuckAvatar({ state, wordTick = 0, level, size = 156 }: Props) {
  const clipId = `jaw-${useId().replace(/:/g, "")}`;
  const body = useRef<SVGGElement>(null);
  const gap = useRef<SVGPathElement>(null);
  const jaw = useRef<SVGGElement>(null);
  const kick = useRef(0);

  useEffect(() => {
    kick.current = 1;
  }, [wordTick]);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let open = 0;
    let frame = 0;
    const t0 = performance.now();

    const draw = (bob: number) => {
      const drop = open * MAX_DROP;
      gap.current?.setAttribute("d", mouth(drop));
      jaw.current?.setAttribute("transform", `translate(0 ${drop.toFixed(2)})`);
      body.current?.setAttribute("transform", `translate(0 ${bob.toFixed(2)})`);
    };

    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      let target = 0;
      const loud = level?.current ?? -1;
      if (state === "speaking" && loud >= 0) {
        // Real audio: the beak follows its loudness.
        target = loud;
      } else if (state === "speaking") {
        // Browser voice, no audio to measure. Two out-of-step waves make an uneven, speech-like flap (~5 syllables/s).
        const a = Math.max(0, Math.sin(t * Math.PI * 2 * 4.7));
        const b = 0.55 + 0.45 * Math.sin(t * Math.PI * 2 * 1.3);
        target = Math.max(a * b, kick.current);
        kick.current *= 0.82;
      }
      // Open fast, close a little slower.
      open += (target - open) * (target > open ? 0.55 : 0.3);
      draw(still || state !== "speaking" ? 0 : Math.sin(t * Math.PI * 2 * 2.3) * 4);
      if (state === "speaking" || open > 0.002) frame = requestAnimationFrame(tick);
      else {
        open = 0;
        draw(0);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state, level]);

  const label = { idle: "Ducky", listening: "Ducky is listening", thinking: "Ducky is thinking", speaking: "Ducky is speaking" }[state];
  const tilt = state === "thinking" ? -4 : state === "listening" ? 3 : 0;

  return (
    <div className="flex-none select-none overflow-hidden rounded-2xl bg-[#9CC0D3]" style={{ width: size, height: size }}>
    <svg role="img" aria-label={label} viewBox="0 0 512 512" width={size} height={size} className="block">
      <defs>
        <clipPath id={clipId}>
          <path d={JAW} />
        </clipPath>
        <radialGradient id={`${clipId}-in`} cx="0.5" cy="1" r="0.8">
          <stop offset="0.25" stopColor="#b4544a" />
          <stop offset="0.8" stopColor="#3d160d" />
        </radialGradient>
      </defs>
      <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: "256px 440px", transition: "transform 0.5s ease-out" }}>
        <g ref={body}>
          <image href={SRC} width="512" height="512" />
          <path ref={gap} d={mouth(0)} fill={`url(#${clipId}-in)`} />
          <g ref={jaw}>
            <image href={SRC} width="512" height="512" clipPath={`url(#${clipId})`} />
          </g>
        </g>
      </g>
    </svg>
    </div>
  );
}
