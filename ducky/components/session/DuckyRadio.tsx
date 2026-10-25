"use client";

import { useEffect, useRef, useState } from "react";
import { DuckyRadio as Engine } from "@/lib/radio";

/**
 * Study music that listens to your reasoning. Pads play from the start; each explained step adds
 * a layer, an open misconception turns the chords tense, and finishing resolves them.
 */
export function DuckyRadioButton({ progress, tension, done }: { progress: number; tension: boolean; done: boolean }) {
  const engine = useRef<Engine | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    engine.current?.set({ progress, tension, done });
  }, [progress, tension, done]);

  useEffect(() => () => engine.current?.stop(), []);

  async function toggle() {
    if (!engine.current) engine.current = new Engine();
    if (on) {
      engine.current.stop();
      setOn(false);
    } else {
      engine.current.set({ progress, tension, done });
      try {
        await engine.current.start();
        setOn(true);
      } catch {
        setOn(false);
      }
    }
  }

  const mood = !on ? "Radio" : done ? "Resolved" : tension ? "Tense" : progress >= 0.75 ? "Full band" : progress >= 0.5 ? "Drums in" : progress >= 0.25 ? "Bass in" : "Warming up";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title="Ducky Radio: lofi that builds as you understand each step and goes tense on a misconception"
      className={`flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition ${
        on ? "border-accent bg-accent-tint text-accent" : "border-line bg-surface text-sub hover:text-ink"
      }`}
    >
      <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`w-[3px] rounded-sm bg-current ${on ? "animate-bar" : ""}`}
            style={{ height: on ? "100%" : `${[40, 70, 50][i]}%`, animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      {mood}
    </button>
  );
}
