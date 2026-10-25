export type Tone = "Socratic" | "Encouraging" | "Exam-style";

/**
 * Per-assignment tutor settings, set only from the teacher's form (ASG-5.3).
 * The jailbreak shield is not a setting: the server always applies it.
 */
export interface Policy {
  /** Hints per question. */
  hintLimit: number;
  /** Points taken off the problem's score per hint used (0 = no penalty). */
  hintPenalty: number;
  /** The tutor may state the final answer once the student has explained their reasoning. */
  revealAnswers: boolean;
  /** Once every hint is used, the student may view the answer for no credit. */
  revealAfterHints: boolean;
  voiceRequired: boolean;
  tone: Tone;
  tools: { visualizations: boolean; webExamples: boolean; calculator: boolean };
  guardrails: { stayOnAssignment: boolean };
}

export type MisconceptionId =
  | "mass-fall-speed"
  | "velocity-vs-acceleration"
  | "sign-of-g"
  | "units"
  | "g-varies-height";

export interface Misconception {
  id: MisconceptionId;
  label: string;
}

/** One detected misconception during a session (feeds the tracker + teacher heatmap). */
export interface MisconceptionEvent {
  id: string;
  misconception: MisconceptionId;
  problem: number; // 1-based problem index
  student: string;
  at: number;
}

export type Role = "tutor" | "student" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  via?: "voice" | "text";
  durationSec?: number;
  flag?: { kind: "misconception" | "guardrail" | "correct"; label: string };
}

export interface Problem {
  index: number;
  total: number;
  course: string;
  set: string;
  prompt: string;
}

export type ReasoningStepStatus = "done" | "broke" | "current" | "todo";
export interface ReasoningStep {
  label: string;
  status: ReasoningStepStatus;
  note?: string;
}

export type PipelineStage = "generate" | "render" | "checks" | "vision" | "regenerate";
export interface PipelineEvent {
  stage: PipelineStage;
  status: "running" | "pass" | "fail";
  text: string;
  pass?: number;
}

export interface LeakHit {
  domain: string;
  title: string;
  match: number;
  url: string;
}

export interface TranscriptRow {
  id: string;
  student: string;
  flag: { kind: "good" | "warn"; label: string };
  at: string;
  aiScore: number;
  override: number | null;
}
