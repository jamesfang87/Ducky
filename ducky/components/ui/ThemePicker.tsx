"use client";

import { useEffect, useRef, useState } from "react";
import { THEMES, useTheme } from "@/lib/theme";

/** Small palette button that opens a menu of themes. Used in every header. */
export function ThemePicker({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}`}
        title="Change theme"
        className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-sub transition hover:text-ink"
      >
        <span
          className="h-4 w-4 rounded-full ring-1 ring-edge"
          style={{ background: `linear-gradient(135deg, ${current.swatch[0]} 50%, ${current.swatch[1]} 50%)` }}
        />
        <span className="hidden sm:inline">{current.label}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="menuitemradio"
              aria-checked={t.id === theme}
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] transition hover:bg-ground ${
                t.id === theme ? "font-semibold text-ink" : "text-sub"
              }`}
            >
              <span
                className="h-5 w-5 flex-none rounded-full ring-1 ring-edge"
                style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }}
              />
              {t.label}
              {t.id === "lofi" && <span className="ml-auto text-[11px] text-muted">+ radio</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
