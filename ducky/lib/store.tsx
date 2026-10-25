"use client";

/**
 * Demo store shared by the student and teacher views.
 * Persists to localStorage and syncs across tabs, so you can open
 * /teacher and /session/demo side by side and watch policy changes and
 * misconception events flow live. Swap for Supabase (+ Realtime) later.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_POLICY } from "./mock";
import type { MisconceptionEvent, Policy } from "./types";

// Bump when DEFAULT_POLICY changes so saved demo state doesn't pin the old defaults (v4: hint penalty).
const KEY = "ducky-demo-v4";

interface State {
  policy: Policy;
  events: MisconceptionEvent[];
}

interface Store extends State {
  setPolicy: (p: Partial<Policy>) => void;
  addEvent: (e: Omit<MisconceptionEvent, "id" | "at">) => void;
  resetDemo: () => void;
}

const Ctx = createContext<Store | null>(null);

function load(): State | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as State;
    return { policy: { ...DEFAULT_POLICY, ...parsed.policy, guardrails: { ...DEFAULT_POLICY.guardrails, ...parsed.policy?.guardrails } }, events: parsed.events ?? [] };
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ policy: DEFAULT_POLICY, events: [] });
  const hydrated = useRef(false);

  useEffect(() => {
    const s = load();
    if (s) setState(s);
    hydrated.current = true;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      const next = load();
      if (next) setState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: in-memory only */
    }
  }, [state]);

  const setPolicy = useCallback((p: Partial<Policy>) => {
    setState((s) => ({ ...s, policy: { ...s.policy, ...p } }));
  }, []);

  const addEvent = useCallback((e: Omit<MisconceptionEvent, "id" | "at">) => {
    setState((s) => ({
      ...s,
      events: [...s.events, { ...e, id: crypto.randomUUID(), at: Date.now() }],
    }));
  }, []);

  const resetDemo = useCallback(() => setState({ policy: DEFAULT_POLICY, events: [] }), []);

  const value = useMemo(() => ({ ...state, setPolicy, addEvent, resetDemo }), [state, setPolicy, addEvent, resetDemo]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}
