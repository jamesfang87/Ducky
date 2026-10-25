"use client";

import { useRef } from "react";

interface Props {
  /** "vertical" is a column divider (drag left/right); "horizontal" is a row divider (drag up/down). */
  orientation: "vertical" | "horizontal";
  label: string;
  /** Current size in px of the thing being resized. */
  measure: () => number;
  min: number;
  max: () => number;
  onResize: (px: number) => void;
  onReset: () => void;
  /** The resized element sits after the handle (left/up grows it). */
  invert?: boolean;
  className?: string;
}

const STEP = 24;

/** Drag (or arrow-key) handle for resizing a panel. Double-click resets to the default size. */
export default function ResizeHandle({ orientation, label, measure, min, max, onResize, onReset, invert, className = "" }: Props) {
  const start = useRef<{ pos: number; size: number } | null>(null);
  const vertical = orientation === "vertical";
  const clamp = (px: number) => Math.round(Math.max(min, Math.min(max(), px)));

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={`${label}. Drag or use arrow keys to resize; double-click to reset.`}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      className={`group flex flex-none touch-none select-none items-center justify-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        vertical ? "w-5 cursor-col-resize self-stretch" : "h-5 cursor-row-resize"
      } ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { pos: vertical ? e.clientX : e.clientY, size: measure() };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const delta = (vertical ? e.clientX : e.clientY) - start.current.pos;
        onResize(clamp(start.current.size + (invert ? -delta : delta)));
      }}
      onPointerUp={() => (start.current = null)}
      onPointerCancel={() => (start.current = null)}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const grow = vertical ? (invert ? "ArrowLeft" : "ArrowRight") : invert ? "ArrowUp" : "ArrowDown";
        const shrink = vertical ? (invert ? "ArrowRight" : "ArrowLeft") : invert ? "ArrowDown" : "ArrowUp";
        if (e.key === grow || e.key === shrink) {
          e.preventDefault();
          onResize(clamp(measure() + (e.key === grow ? STEP : -STEP)));
        } else if (e.key === "Enter") {
          e.preventDefault();
          onReset();
        }
      }}
    >
      <span
        aria-hidden="true"
        className={`flex items-center justify-center gap-[3px] rounded-full border border-edge bg-white shadow-sm transition group-hover:border-accent group-hover:bg-accent-tint group-active:border-accent group-active:bg-accent-tint ${
          vertical ? "h-16 w-3.5 flex-col" : "h-3.5 w-16"
        }`}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-[3px] w-[3px] rounded-full bg-sub group-hover:bg-accent" />
        ))}
      </span>
    </div>
  );
}
