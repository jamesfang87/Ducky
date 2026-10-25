"use client";

/**
 * Ducky's face: a flat 2D drawing of the 3D mascot (yellow duckling, grey "D" hoodie,
 * hand on chin). Drawn as SVG so the bill can really open: the lower bill drops and
 * the mouth behind it grows. Coordinates are in a 512×512 viewBox.
 *
 * With ElevenLabs audio the beak follows its loudness (`level`). With the browser
 * voice there's no audio to measure, so it flaps in a syllable-like rhythm and snaps
 * open on word-boundary events.
 */
import { useEffect, useRef } from "react";

const MAX_DROP = 22; // how far the lower bill drops when fully open, viewBox px

const C = {
  sky: "#A9CBE0",
  yellow: "#F9D649",
  yellowShade: "#EDBF2E",
  bill: "#F4A340",
  billShade: "#E08A2A",
  mouth: "#5A2318",
  tongue: "#D9695A",
  hoodie: "#5F646B",
  hoodieShade: "#4E5258",
  ink: "#2E2420",
  brow: "#B8862F",
  iris: "#7A5530",
  blush: "#F6A96A",
};

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
  const body = useRef<SVGGElement>(null);
  const jaw = useRef<SVGGElement>(null);
  const mouth = useRef<SVGPathElement>(null);
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
      jaw.current?.setAttribute("transform", `translate(0 ${drop.toFixed(2)})`);
      // Mouth: a dark shape from the upper bill's edge down to the dropped lower bill.
      mouth.current?.setAttribute(
        "d",
        drop < 0.5 ? "" : `M196 262 Q256 ${268 - drop * 0.1} 316 262 Q312 ${270 + drop} 256 ${276 + drop} Q200 ${270 + drop} 196 262 Z`,
      );
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
        // Browser voice, no audio to measure. Two out-of-step waves make an uneven,
        // speech-like flap (~5 syllables/s).
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
  // Eyes glance up while thinking, at the student while listening.
  const look = state === "thinking" ? { x: 4, y: -7 } : state === "listening" ? { x: -3, y: 2 } : { x: 3, y: -3 };

  return (
    <div className="relative flex-none select-none overflow-hidden rounded-2xl" style={{ width: size, height: size, background: "rgb(var(--accent-tint))" }}>
      {/* The backdrop shifts with what Ducky is doing, and follows the theme. */}
      {(
        [
          ["idle", "radial-gradient(circle at 50% 70%, rgb(var(--accent-glow) / 0.18), transparent 70%)"],
          ["listening", "radial-gradient(circle at 50% 60%, rgb(var(--accent) / 0.5), rgb(var(--accent-tint)) 75%)"],
          ["thinking", "radial-gradient(circle at 50% 60%, rgb(var(--warn-soft) / 0.7), rgb(var(--accent-tint)) 75%)"],
          ["speaking", "radial-gradient(circle at 50% 55%, rgb(255 214 77 / 0.65), rgb(var(--accent-glow) / 0.35) 55%, rgb(var(--accent-tint)) 85%)"],
        ] as const
      ).map(([s, bg]) => (
        <div key={s} aria-hidden="true" className="absolute inset-0 transition-opacity duration-700" style={{ background: bg, opacity: state === s ? 1 : 0 }} />
      ))}
      <svg role="img" aria-label={label} viewBox="0 0 512 512" width={size} height={size} className="relative block">
        <style>{`
          .duck-blink { animation: duck-blink 4.6s infinite; transform-box: fill-box; transform-origin: center; }
          @keyframes duck-blink { 0%, 95%, 100% { transform: scaleY(1); } 97% { transform: scaleY(0.1); } }
          @media (prefers-reduced-motion: reduce) { .duck-blink { animation: none; } }
        `}</style>

        {/* ground shadow */}
        <ellipse cx="256" cy="492" rx="120" ry="12" fill="#000" opacity="0.08" />

        <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: "256px 470px", transition: "transform 0.5s ease-out" }}>
          <g ref={body}>
            {/* feet */}
            <ellipse cx="212" cy="482" rx="34" ry="13" fill={C.bill} />
            <ellipse cx="300" cy="482" rx="34" ry="13" fill={C.bill} />

            {/* belly below the hoodie */}
            <ellipse cx="256" cy="450" rx="88" ry="34" fill={C.yellow} />

            {/* left arm, hanging */}
            <path d="M160 352 Q132 380 140 432 Q146 450 162 440 Q170 404 186 378 Z" fill={C.yellow} />
            {/* hoodie */}
            <path d="M178 322 Q256 300 334 322 Q368 352 362 404 Q358 444 330 456 Q256 470 182 456 Q154 444 150 404 Q144 352 178 322 Z" fill={C.hoodie} />
            <path d="M160 352 Q146 378 150 404 L170 400 Q170 372 182 348 Z" fill={C.hoodieShade} />
            {/* hood collar */}
            <path d="M196 316 Q256 352 316 316 Q300 338 256 344 Q212 338 196 316 Z" fill={C.hoodieShade} />
            {/* pocket and drawstrings */}
            <path d="M206 410 Q256 400 306 410 L314 446 Q256 452 198 446 Z" fill={C.hoodieShade} />
            <path d="M236 340 L234 386 M262 342 L262 386" stroke="#8C9198" strokeWidth="4" strokeLinecap="round" />
            {/* the D */}
            <text x="286" y="388" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="34" fill="#80858C">D</text>

            {/* head */}
            <g>
              {/* tuft */}
              <path d="M256 92 Q236 52 250 40 Q262 56 260 88 Z" fill={C.yellow} />
              <path d="M262 92 Q272 52 292 50 Q290 74 268 96 Z" fill={C.yellow} />
              <path d="M248 94 Q218 66 222 56 Q240 62 254 92 Z" fill={C.yellow} />
              <ellipse cx="256" cy="200" rx="128" ry="122" fill={C.yellow} />
              <path d="M138 230 Q160 316 256 322 Q352 316 374 230 Q350 296 256 302 Q162 296 138 230 Z" fill={C.yellowShade} opacity="0.6" />

              {/* cheeks */}
              <ellipse cx="166" cy="240" rx="20" ry="12" fill={C.blush} opacity="0.35" />
              <ellipse cx="346" cy="240" rx="20" ry="12" fill={C.blush} opacity="0.35" />

              {/* brows, raised in the middle: curious */}
              <path d="M178 150 Q200 136 226 146" stroke={C.brow} strokeWidth="9" strokeLinecap="round" fill="none" />
              <path d="M286 146 Q312 136 334 150" stroke={C.brow} strokeWidth="9" strokeLinecap="round" fill="none" />

              {/* eyes */}
              {[202, 310].map((cx) => (
                <g key={cx} className="duck-blink">
                  <ellipse cx={cx} cy="198" rx="34" ry="37" fill="#fff" />
                  <g style={{ transform: `translate(${look.x}px, ${look.y}px)`, transition: "transform 0.4s ease-out" }}>
                    <circle cx={cx} cy="198" r="21" fill={C.iris} />
                    <circle cx={cx} cy="198" r="12" fill={C.ink} />
                    <circle cx={cx + 7} cy="190" r="6" fill="#fff" />
                  </g>
                </g>
              ))}

              {/* mouth interior, drawn per frame */}
              <path ref={mouth} d="" fill={C.mouth} />
              {/* lower bill (drops when talking) */}
              <g ref={jaw}>
                <path d="M200 262 Q256 270 312 262 Q306 286 256 290 Q206 286 200 262 Z" fill={C.billShade} />
              </g>
              {/* upper bill */}
              <path d="M178 250 Q182 222 256 222 Q330 222 334 250 Q332 268 256 268 Q180 268 178 250 Z" fill={C.bill} />
              <path d="M240 236 Q244 233 248 236 M264 236 Q268 233 272 236" stroke={C.billShade} strokeWidth="4" strokeLinecap="round" fill="none" />
            </g>

            {/* right hand on chin, just below the bill so it never covers the mouth */}
            <g transform="translate(6 18)">
            <path d="M318 330 Q350 326 374 330 Q392 304 376 282 Q360 270 344 284 Q352 304 318 318 Z" fill={C.hoodie} />
            <path d="M344 284 Q360 272 376 282 Q368 292 352 296 Z" fill={C.hoodieShade} />
            <path
              d="M346 292 Q328 300 312 296 Q296 290 300 276 Q304 266 316 270 L324 274 Q318 260 328 254 Q338 250 344 262 Q352 252 362 258 Q372 268 366 282 Q360 292 346 292 Z"
              fill={C.yellow}
            />
            <path d="M326 276 Q332 268 338 272 M344 266 Q348 272 346 280" stroke={C.yellowShade} strokeWidth="4" strokeLinecap="round" fill="none" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
