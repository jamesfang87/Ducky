"use client";

import { useRef } from "react";

/** Minimal pointer-drawing pad. TODO: upload the PNG and send it to a vision model with the turn. */
export default function SketchPad({ onSend, onCancel }: { onSend: (png: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * e.currentTarget.width, ((e.clientY - r.top) / r.height) * e.currentTarget.height];
  };

  return (
    <div className="rounded-[10px] border border-edge bg-white p-2">
      <canvas
        ref={ref}
        width={800}
        height={260}
        aria-label="Sketch area"
        className="h-[160px] w-full touch-none rounded-md bg-[#FAFBF9]"
        onPointerDown={(e) => {
          drawing.current = true;
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          ctx.lineWidth = 4;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#14171C";
          const [x, y] = pos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={() => (drawing.current = false)}
      />
      <div className="mt-2 flex justify-end gap-2">
        <button className="btn h-9" onClick={() => ref.current?.getContext("2d")?.clearRect(0, 0, 800, 260)}>
          Clear
        </button>
        <button className="btn h-9" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary h-9" onClick={() => onSend(ref.current?.toDataURL("image/png") ?? "")}>
          Send sketch
        </button>
      </div>
    </div>
  );
}
