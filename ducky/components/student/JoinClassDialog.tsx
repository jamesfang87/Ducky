"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeJoinCode } from "@/lib/classes";
import type { JoinResult } from "@/lib/useClasses";

export function JoinClassDialog({
  onClose,
  join,
}: {
  onClose: () => void;
  join: (code: string) => JoinResult;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = join(code);
    if (result.ok) onClose();
    else setError(result.error);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-title"
        className="w-full max-w-[420px] rounded-2xl border border-line bg-white p-6 shadow-xl animate-fadein"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="join-title" className="font-display text-[22px] font-semibold">
              Join a class
            </h2>
            <p className="mt-1 text-sm text-sub">Enter the 6-character code from your teacher.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted transition hover:bg-ground hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="mt-5">
          <label htmlFor="join-code" className="mb-1.5 block text-sm font-semibold">
            Class code
          </label>
          <input
            id="join-code"
            ref={inputRef}
            value={code}
            onChange={(event) => {
              setCode(normalizeJoinCode(event.target.value));
              setError(null);
            }}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={6}
            placeholder="ABC234"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "join-error" : undefined}
            className="h-14 w-full rounded-xl border border-edge bg-white px-3 text-center font-mono text-2xl uppercase tracking-[0.3em] placeholder:tracking-[0.3em] placeholder:text-muted/50"
          />

          {error && (
            <p id="join-error" role="alert" className="mt-2 text-sm text-warn">
              {error}
            </p>
          )}

          <button type="submit" disabled={code.length !== 6} className="btn-primary mt-4 w-full">
            Join class
          </button>
        </form>

        <p className="mt-4 text-center text-[12.5px] text-muted">Demo codes: CHM7Q3 · CSC9X2 · MTH4D2</p>
      </div>
    </div>
  );
}
