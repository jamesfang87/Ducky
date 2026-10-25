import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_POLICY, HINTS, INITIAL_STEPS, MISCONCEPTIONS, PROBLEM } from "@/lib/mock";
import type { Policy, Problem } from "@/lib/types";

/**
 * Temporary in-memory data store for the tutoring loop. Every route goes through
 * these functions, so swapping in Supabase later only changes this file.
 *
 * Each signed-in user gets their own copy of a session template ("demo",
 * "demo-cs"), keyed by (sessionId, userId), so nobody can read or advance
 * someone else's session.
 */

/** Server-side misconception: ids are per subject, so wider than the UI's physics-only union. */
export interface ServerMisconception {
  id: string;
  label: string;
}

/** One detected misconception (feeds the tracker + teacher heatmap). */
export interface ServerMisconceptionEvent {
  id: string;
  misconception: string;
  problem: number;
  student: string;
  at: number;
}

/** Teacher policy plus server-only settings that aren't in the shared UI type yet. */
export type ServerPolicy = Policy & {
  /** Once every hint is used, the student may view the answer for no credit. */
  revealAfterHints: boolean;
};

export interface Solution {
  text: string;
  /** Spoken sentences matching any of these leak the answer (GRD-4, simple version). */
  finalAnswerPatterns: RegExp[];
}

export interface ServerSession {
  id: string;
  userId: string;
  student: string;
  problemIndex: number;
  hintsUsed: number;
  currentStep: number;
  /** Reasoning steps the student has explained correctly (0-based, sorted). */
  completedSteps: number[];
  /** The step the student was on when their last hint was used. */
  stepWhenHintsRanOut: number | null;
  revealed: boolean;
  /** The student explained their full reasoning; the tutor asks no more questions. */
  completed: boolean;
  creditEligible: boolean;
  /** Visual explanations generated so far, and whether one is being made now (rate limit). */
  visualsMade: number;
  visualBusy: boolean;
  /** Study-resource searches so far (each costs a SerpApi credit unless cached). */
  resourceSearches: number;
}

export interface StoredTurn {
  role: "student" | "tutor";
  text: string;
  via?: "voice" | "text";
  at: number;
}

export interface GuardEvent {
  kind: "answer_leak" | "hint_limit" | "visual_declined" | "visual_failed";
  excerpt: string;
  at: number;
}

export interface RevealEvent {
  id: string;
  student: string;
  problem: number;
  stepIndex: number;
  stepLabel: string;
  at: number;
}

interface Template {
  problem: Problem;
  policy: ServerPolicy;
  solution: Solution;
  misconceptions: ServerMisconception[];
  hints: string[];
  steps: string[];
  startStep: number;
  /** Ducky's first line, shown before the student says anything. */
  opening: string;
}

const TEMPLATES: Record<string, Template> = {
  demo: {
    problem: PROBLEM,
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text: "t = √(2h/g) ≈ 2.02 s for both balls. Mass cancels because a = F/m = mg/m = g, so both accelerate at g.",
      finalAnswerPatterns: [/2\.02/, /√\s*\(?\s*2\s*h\s*\/\s*g/i, /sqrt\s*\(?\s*2\s*h\s*\/\s*g/i],
    },
    misconceptions: MISCONCEPTIONS,
    hints: [...HINTS],
    steps: INITIAL_STEPS.map((s) => s.label),
    startStep: Math.max(0, INITIAL_STEPS.findIndex((s) => s.status === "current")),
    opening: "Before we calculate anything: if you drop both balls at the same moment, what do you expect to happen?",
  },
  "demo-cs": {
    problem: {
      index: 1,
      total: 4,
      course: "CS 314",
      set: "Problem Set 1 · Insertion sort",
      prompt:
        "Trace insertion sort on the array [5, 2, 4, 6, 1, 3], showing the array after each pass of the outer loop. Then explain why insertion sort takes O(n²) comparisons in the worst case, and what input causes that worst case.",
    },
    policy: { ...DEFAULT_POLICY, revealAfterHints: true },
    solution: {
      text:
        "Passes: [2,5,4,6,1,3] → [2,4,5,6,1,3] → [2,4,5,6,1,3] → [1,2,4,5,6,3] → [1,2,3,4,5,6]. " +
        "Each new element is compared with every element in the sorted prefix in the worst case, so the total is 1 + 2 + … + (n−1) = n(n−1)/2 = O(n²). " +
        "The worst case is a reverse-sorted array.",
      finalAnswerPatterns: [
        /\[\s*1\s*,\s*2\s*,\s*3\s*,\s*4\s*,\s*5\s*,\s*6\s*\]/,
        /\[\s*1\s*,\s*2\s*,\s*4\s*,\s*5\s*,\s*6\s*,\s*3\s*\]/,
        /n\s*\(\s*n\s*[-−]\s*1\s*\)\s*\/\s*2/i,
      ],
    },
    misconceptions: [
      { id: "cs-swap-vs-shift", label: "Thinks insertion sort swaps distant elements instead of shifting the prefix" },
      { id: "cs-prefix-unsorted", label: "Doesn't see that the left part is always sorted" },
      { id: "cs-best-case-n2", label: "Thinks it's O(n²) even on already-sorted input" },
      { id: "cs-worst-case-input", label: "Wrong worst-case input (e.g. random instead of reverse-sorted)" },
      { id: "cs-counts-passes-not-comparisons", label: "Counts outer passes (n) instead of total comparisons" },
    ],
    hints: [
      "Look only at the first two elements. After the first pass, what must be true about the part of the array to the left of the element you're inserting?",
      "For the element at index i, how many elements might it have to move past in the worst case? Now add that up for every i.",
    ],
    steps: [
      "Understand the invariant: the left part is sorted",
      "Trace each pass on [5, 2, 4, 6, 1, 3]",
      "Count comparisons in the worst case",
      "Name the worst-case input and the Big-O",
    ],
    startStep: 0,
    opening: "Before we trace anything: when insertion sort looks at a new element, what's true about everything to its left?",
  },
};

interface Db {
  sessions: Map<string, ServerSession>;
  turns: Map<string, StoredTurn[]>;
  misconceptionEvents: ServerMisconceptionEvent[];
  guardEvents: (GuardEvent & { sessionKey: string })[];
  revealEvents: RevealEvent[];
  /** Session keys whose saved chat has already been read from Supabase this process. */
  hydrated: Set<string>;
}

// Kept on globalThis so `next dev` hot reloads don't wipe the demo state.
const g = globalThis as typeof globalThis & { __duckyDb?: Db };
const db: Db = (g.__duckyDb ??= {
  sessions: new Map(),
  turns: new Map(),
  misconceptionEvents: [],
  guardEvents: [],
  revealEvents: [],
  hydrated: new Set(),
});
db.hydrated ??= new Set();

const keyOf = (s: Pick<ServerSession, "id" | "userId">) => `${s.id}:${s.userId}`;

/** Returns the caller's own copy of the session, creating it on first use. Null if no such session. */
export function getSession(sessionId: string, user: { userId: string; name: string }): ServerSession | null {
  const t = TEMPLATES[sessionId];
  if (!t) return null;
  const key = `${sessionId}:${user.userId}`;
  let s = db.sessions.get(key);
  if (!s) {
    s = {
      id: sessionId,
      userId: user.userId,
      student: user.name,
      problemIndex: t.problem.index,
      hintsUsed: 0,
      currentStep: t.startStep,
      completedSteps: Array.from({ length: t.startStep }, (_, i) => i),
      stepWhenHintsRanOut: null,
      revealed: false,
      completed: false,
      creditEligible: true,
      visualsMade: 0,
      visualBusy: false,
      resourceSearches: 0,
    };
    db.sessions.set(key, s);
  }
  return s;
}

export const getProblem = (s: ServerSession): Problem => TEMPLATES[s.id].problem;
export const getPolicy = (s: ServerSession): ServerPolicy => TEMPLATES[s.id].policy;
/** Server-only. Never put this in a response, except through the gated reveal route. */
export const getSolution = (s: ServerSession): Solution => TEMPLATES[s.id].solution;
export const getMisconceptions = (s: ServerSession): ServerMisconception[] => TEMPLATES[s.id].misconceptions;
export const getOpening = (s: ServerSession): string => TEMPLATES[s.id].opening;
export const getHints = (s: ServerSession): string[] => TEMPLATES[s.id].hints;
export const getSteps = (s: ServerSession): string[] => TEMPLATES[s.id].steps;

export function getRecentTurns(s: ServerSession, n = 6): StoredTurn[] {
  return (db.turns.get(keyOf(s)) ?? []).slice(-n);
}

/**
 * After a cold start the in-memory turns are empty even though the student's chat was
 * saved (lib/chatHistory.ts). Reload it once so the tutor keeps the conversation's context.
 */
export async function loadSavedTurns(s: ServerSession, fromClient: Omit<StoredTurn, "at">[] = []): Promise<void> {
  const key = keyOf(s);
  if (db.hydrated.has(key)) return;
  db.hydrated.add(key);
  if (db.turns.get(key)?.length) return;
  // Until the chat_histories table exists the chat lives only in the browser, so fall back to the page's copy.
  const seedFromClient = () => {
    if (!db.turns.get(key)?.length && fromClient.length) db.turns.set(key, fromClient.map((t) => ({ ...t, at: Date.now() })));
  };
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("chat_histories")
      .select("messages, updated_at")
      .eq("user_id", s.userId)
      .eq("session_id", s.id)
      .maybeSingle();
    const saved = Array.isArray(data?.messages) ? (data.messages as { role?: string; text?: unknown; via?: unknown }[]) : [];
    const at = data?.updated_at ? Date.parse(data.updated_at) : Date.now();
    const turns: StoredTurn[] = saved.flatMap((m) =>
      (m.role === "student" || m.role === "tutor") && typeof m.text === "string"
        ? [{ role: m.role, text: m.text, via: m.via === "voice" || m.via === "text" ? m.via : undefined, at }]
        : [],
    );
    if (turns.length) db.turns.set(key, [...turns, ...(db.turns.get(key) ?? [])]);
  } catch (e) {
    console.error("[loadSavedTurns]", e); // no saved context; the session still works
  }
  seedFromClient();
}

export function saveTurn(s: ServerSession, turn: Omit<StoredTurn, "at">): void {
  const key = keyOf(s);
  const list = db.turns.get(key) ?? [];
  list.push({ ...turn, at: Date.now() });
  db.turns.set(key, list);
}

/** Counts a hint. When the last one is used, remembers which step the student was stuck on. */
export function incrementHints(s: ServerSession): number {
  s.hintsUsed += 1;
  if (s.hintsUsed >= getPolicy(s).hintLimit && s.stepWhenHintsRanOut === null) {
    s.stepWhenHintsRanOut = s.currentStep;
  }
  return s.hintsUsed;
}

export function setCurrentStep(s: ServerSession, step: number): void {
  const last = getSteps(s).length - 1;
  s.currentStep = Math.min(last, Math.max(0, Math.round(step)));
}

/** Marks steps done and moves the current step off any completed one, to the first step still open. */
export function completeSteps(s: ServerSession, steps: number[]): number[] {
  const count = getSteps(s).length;
  const done = new Set(s.completedSteps);
  const added = steps.filter((i) => Number.isInteger(i) && i >= 0 && i < count && !done.has(i));
  for (const i of added) done.add(i);
  s.completedSteps = [...done].sort((a, b) => a - b);
  if (done.has(s.currentStep)) {
    const open = Array.from({ length: count }, (_, i) => i).find((i) => !done.has(i));
    s.currentStep = open ?? count - 1;
  }
  return added;
}

export function canReveal(s: ServerSession): boolean {
  return s.hintsUsed >= getPolicy(s).hintLimit && getPolicy(s).revealAfterHints && !s.revealed && !s.completed;
}

export function markRevealed(s: ServerSession): void {
  s.revealed = true;
  s.creditEligible = false;
}

export function saveMisconceptionEvent(s: ServerSession, misconception: string): ServerMisconceptionEvent {
  const e: ServerMisconceptionEvent = {
    id: crypto.randomUUID(),
    misconception,
    problem: s.problemIndex,
    student: s.student,
    at: Date.now(),
  };
  db.misconceptionEvents.push(e);
  return e;
}

export function saveGuardEvent(s: ServerSession, e: Omit<GuardEvent, "at">): void {
  db.guardEvents.push({ ...e, at: Date.now(), sessionKey: keyOf(s) });
}

export function saveRevealEvent(s: ServerSession, stepIndex: number): RevealEvent {
  const e: RevealEvent = {
    id: crypto.randomUUID(),
    student: s.student,
    problem: s.problemIndex,
    stepIndex,
    stepLabel: getSteps(s)[stepIndex] ?? "",
    at: Date.now(),
  };
  db.revealEvents.push(e);
  return e;
}
