import type {
  Misconception,
  MisconceptionId,
  Policy,
  Problem,
  ReasoningStep,
  TranscriptRow,
  LeakHit,
} from "./types";

// All data in this file is demo placeholder data. Replace with Supabase queries.

export const DEFAULT_POLICY: Policy = {
  hintLimit: 2,
  revealAnswers: false,
  voiceRequired: false,
  tone: "Socratic",
  tools: { visualizations: true, webExamples: true, calculator: false },
  guardrails: { jailbreakShield: true, stayOnAssignment: true },
};

export const MISCONCEPTIONS: Misconception[] = [
  { id: "mass-fall-speed", label: "Mass changes fall speed" },
  { id: "velocity-vs-acceleration", label: "Velocity vs. acceleration" },
  { id: "sign-of-g", label: "Sign of g" },
  { id: "units", label: "Units: m/s vs. m/s²" },
  { id: "g-varies-height", label: "g changes with height" },
];

export const PROBLEM: Problem = {
  index: 2,
  total: 6,
  course: "PHYS 1401",
  set: "Problem Set 3 · Free fall",
  prompt:
    "A 1.0 kg ball and a 10 kg ball are dropped from rest at h = 20 m. Ignoring air resistance, find the time each takes to reach the ground and explain why.",
};

export const INITIAL_STEPS: ReasoningStep[] = [
  { label: "Set up knowns: h, m₁, m₂, v₀ = 0", status: "done" },
  { label: "Predict what happens", status: "current" },
  { label: "Relate F = ma to each ball", status: "todo" },
  { label: "Solve for t", status: "todo" },
];

export const HINTS = [
  "Write Newton's second law for each ball separately. What is the force of gravity on a ball of mass m?",
  "Divide the force by the mass. Does the mass survive in your expression for a?",
];

/** Baseline class heatmap: students affected per misconception per problem (P1..P6). */
export const BASE_HEATMAP: Record<MisconceptionId, number[]> = {
  "mass-fall-speed": [2, 11, 9, 3, 1, 0],
  "velocity-vs-acceleration": [5, 7, 4, 11, 6, 2],
  "sign-of-g": [1, 3, 8, 6, 2, 1],
  units: [6, 2, 1, 4, 9, 3],
  "g-varies-height": [0, 1, 2, 1, 3, 7],
};

/** The current student's history this unit (before today's session). */
export const STUDENT_HISTORY: Record<MisconceptionId, number> = {
  "mass-fall-speed": 2,
  "velocity-vs-acceleration": 2,
  "sign-of-g": 1,
  units: 0,
  "g-varies-height": 0,
};

export const LEAK_HITS: LeakHit[] = [
  { domain: "quizlet.com", title: "Flashcard set: “two balls dropped 20 m”", match: 94, url: "#" },
  { domain: "chegg.com", title: "Q&A post with worked solution", match: 88, url: "#" },
];

export const TRANSCRIPTS: TranscriptRow[] = [
  { id: "t1", student: "M. Ortiz", flag: { kind: "good", label: "Self-corrected" }, at: "2:14", aiScore: 88, override: null },
  { id: "t2", student: "J. Nguyen", flag: { kind: "warn", label: "Asked for answer 3×" }, at: "0:48", aiScore: 52, override: null },
  { id: "t3", student: "A. Patel", flag: { kind: "warn", label: "Jailbreak attempt blocked" }, at: "1:30", aiScore: 61, override: 70 },
];

export const STUDENT_NAME = "K. Li";
