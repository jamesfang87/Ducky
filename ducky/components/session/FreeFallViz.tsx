"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Spinner } from "@/components/ui/icons";

const G = 9.8;
const H = 20; // meters
const DT = 0.005;
const PX_PER_M = 12;
const TOP = 30;
const GROUND = TOP + H * PX_PER_M; // 270
const SLOWMO = 0.6; // play slower than real time so the eye can follow

/** Integrates fall distance over time with optional quadratic drag. */
function trajectory(mass: number, c: number): { d: number[]; tLand: number } {
  const d: number[] = [0];
  let v = 0;
  let x = 0;
  let t = 0;
  while (x < H && t < 20) {
    const a = G - (c / mass) * v * v;
    v += a * DT;
    x += v * DT;
    t += DT;
    d.push(Math.min(x, H));
  }
  return { d, tLand: t };
}

const at = (traj: number[], t: number) => traj[Math.min(traj.length - 1, Math.max(0, Math.round(t / DT)))];
const y = (dist: number) => TOP + dist * PX_PER_M;

interface Props {
  buggy: boolean;
  reviewed: boolean;
  reviewing: boolean;
  passes: number;
}

export default function FreeFallViz({ buggy, reviewed, reviewing, passes }: Props) {
  const [drag, setDrag] = useState(0);
  const [t, setT] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const raf = useRef<number>(0);

  const c = drag * 0.004;
  const light = useMemo(() => trajectory(1, c), [c]);
  const heavy = useMemo(() => trajectory(10, c), [c]);
  const tEnd = Math.max(light.tLand, heavy.tLand);

  useEffect(() => {
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const tt = ((now - start) / 1000) * SLOWMO;
      setT(Math.min(tt, tEnd));
      if (tt < tEnd) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [runKey, tEnd]);

  const ghosts = [0.5, 1.0, 1.5].filter((g) => g < t);
  const yL = y(at(light.d, t));
  const yH = y(at(heavy.d, t));

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 px-5 py-4">
        <h2 className="h2">Two balls in free fall</h2>
        <div className="flex-1" />
        {reviewing && (
          <span className="flex items-center gap-1.5 rounded-full bg-warn-tint px-2.5 py-1 text-[13px] font-medium text-warn-dark">
            <Spinner /> Reviewing…
          </span>
        )}
        {reviewed && !reviewing && (
          <span className="flex items-center gap-1.5 rounded-full bg-accent-tint px-2.5 py-1 text-[13px] font-medium text-accent-dark">
            <Check /> Reviewed · {passes} passes
          </span>
        )}
      </div>

      <svg
        viewBox="0 0 440 300"
        className="block h-auto w-full border-y border-line bg-[#FAFBF9]"
        role="img"
        aria-label={`A 1 kg and a 10 kg ball falling 20 m. At t = ${t.toFixed(1)} s the 1 kg ball has fallen ${at(light.d, t).toFixed(1)} m and the 10 kg ball ${at(heavy.d, t).toFixed(1)} m.`}
      >
        <g fontFamily="var(--font-mono)" fontSize="10" fill="#5A626C">
          {[0, 5, 10, 15, 20].map((m) => (
            <text key={m} x="16" y={y(m) + 3}>
              {m === 0 ? "0 m" : m}
            </text>
          ))}
        </g>
        <g stroke="#E2E4DF">
          {[0, 5, 10, 15].map((m) => (
            <line key={m} x1="48" y1={y(m)} x2="420" y2={y(m)} />
          ))}
        </g>
        <line x1="48" y1={GROUND + 2} x2="420" y2={GROUND + 2} stroke="#14171C" strokeWidth="2" />

        {/* time ghosts */}
        {ghosts.map((g) => {
          const gl = y(at(light.d, g));
          const gh = y(at(heavy.d, g));
          return (
            <g key={g}>
              <line x1="110" y1={gl} x2="340" y2={gh} stroke="#0B7A62" strokeDasharray="3 4" />
              <circle cx="140" cy={gl} r="9" fill="#14171C" opacity="0.15" />
              <circle cx="300" cy={gh} r="15" fill="#14171C" opacity="0.15" />
              <text x="352" y={gh + 4} fontFamily="var(--font-mono)" fontSize="10" fill="#075A48">
                t = {g.toFixed(1)} s
              </text>
            </g>
          );
        })}

        <circle cx="140" cy={yL} r="9" fill="#14171C" />
        <circle cx="300" cy={yH} r="15" fill="#14171C" />

        {/* labels: the buggy version overlaps the time label, which the reviewer catches */}
        <g fontFamily="var(--font-inter)" fontSize="11" fontWeight="600" fill="#14171C">
          {buggy ? (
            <>
              {/* v1 bug: labels drawn on top of the moving balls */}
              <text x="122" y={yL + 4}>m = 1 kg</text>
              <text x="272" y={yH + 4}>m = 10 kg</text>
              <rect x="262" y={yH - 20} width="76" height="40" rx="4" fill="none" stroke="#A3530A" strokeWidth="1.5" strokeDasharray="4 3" />
              <text x="262" y={yH - 26} fontSize="10" fill="#A3530A" fontFamily="var(--font-mono)">overlap</text>
            </>
          ) : (
            <>
              <text x="114" y="16">m = 1 kg</text>
              <text x="270" y="16">m = 10 kg</text>
            </>
          )}
        </g>

        <g fontFamily="var(--font-mono)" fontSize="10" fill="#5A626C">
          <text x="60" y="292">t = {t.toFixed(2)} s</text>
          <text x="166" y="292">
            {drag === 0 ? "a = F/m = mg/m = 9.8 m/s² for both" : `land: 1 kg ${light.tLand.toFixed(2)} s · 10 kg ${heavy.tLand.toFixed(2)} s`}
          </text>
        </g>
      </svg>

      <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
        <label htmlFor="drag" className="flex items-center gap-2.5 text-sm">
          Air resistance
          <input
            id="drag"
            type="range"
            min={0}
            max={100}
            value={drag}
            onChange={(e) => {
              setDrag(Number(e.target.value));
              setRunKey((k) => k + 1);
            }}
            className="w-36 accent-accent"
          />
        </label>
        <button className="btn h-10" onClick={() => setRunKey((k) => k + 1)}>
          Replay
        </button>
        <span className="text-[13px] text-muted">
          {drag === 0 ? "Live SVG · try adding air resistance" : "With air, drag slows the light ball more"}
        </span>
      </div>
    </div>
  );
}
