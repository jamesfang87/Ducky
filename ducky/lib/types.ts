export type Tone = "Socratic" | "Encouraging" | "Exam-style";

export interface Policy {
  model: "Muse Spark" | "Claude";
  hintLimit: number;
  revealAnswers: boolean;
  voiceRequired: boolean;
  timeLimitMin: number | null;
  tone: Tone;
  tools: { visualizations: boolean; webExamples: boolean; calculator: boolean };
  guardrails: { jailbreakShield: boolean; stayOnAssignment: boolean };
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
