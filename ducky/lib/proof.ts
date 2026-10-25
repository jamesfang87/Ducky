import type { ChatMessage, ReasoningStep } from "./types";

export interface ProofSummary {
  student: string;
  course: string;
  set: string;
  problem: string;
  issuedAt: string;
  spoken: number;
  typed: number;
  voiceSeconds: number;
  words: number;
  stepsDone: number;
  stepsTotal: number;
  stepLabels: { label: string; done: boolean }[];
  hintsUsed: number;
  hintLimit: number;
  revealed: boolean;
  caught: string[];
  fixed: string[];
  transcript: { role: string; via?: string; text: string }[];
}

const FLAGGED = "Misconception flagged: ";
const CORRECTED = "Misconception corrected: ";

/** Collects what the student did in this session into something a teacher or registrar can read. */
export function buildProof(args: {
  student: string;
  course: string;
  set: string;
  problem: string;
  messages: ChatMessage[];
  steps: ReasoningStep[];
  hintsUsed: number;
  hintLimit: number;
  revealed: boolean;
}): ProofSummary {
  const said = args.messages.filter((m) => m.role === "student");
  const caught = new Set<string>();
  const fixed = new Set<string>();
  for (const m of args.messages) {
    if (m.flag?.kind === "misconception") caught.add(m.flag.label.replace(FLAGGED, ""));
    if (m.flag?.kind === "correct" && m.text.startsWith(CORRECTED)) fixed.add(m.text.slice(CORRECTED.length));
  }
  return {
    student: args.student,
    course: args.course,
    set: args.set,
    problem: args.problem,
    issuedAt: new Date().toISOString(),
    spoken: said.filter((m) => m.via === "voice").length,
    typed: said.filter((m) => m.via !== "voice").length,
    voiceSeconds: Math.round(said.reduce((t, m) => t + (m.durationSec ?? 0), 0)),
    words: said.reduce((t, m) => t + m.text.split(/\s+/).filter(Boolean).length, 0),
    stepsDone: args.steps.filter((s) => s.status === "done").length,
    stepsTotal: args.steps.length,
    stepLabels: args.steps.map((s) => ({ label: s.label, done: s.status === "done" })),
    hintsUsed: args.hintsUsed,
    hintLimit: args.hintLimit,
    revealed: args.revealed,
    caught: [...caught],
    fixed: [...fixed],
    transcript: args.messages.map((m) => ({ role: m.role, via: m.via, text: m.text })),
  };
}

/**
 * SHA-256 over the full transcript plus who and what it is for. Change one word anywhere and the
 * code changes, so a copy of the receipt can be checked against the stored transcript.
 */
export async function fingerprint(p: ProofSummary): Promise<string> {
  const body = JSON.stringify({ s: p.student, c: p.course, set: p.set, p: p.problem, t: p.transcript });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
