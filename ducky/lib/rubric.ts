import type { ChatMessage, ReasoningStep } from "./types";

export const RUBRIC_MAX = 4;

export interface RubricRow {
  id: string;
  label: string;
  /** null until there is enough of the session to score it. */
  score: number | null;
  why: string;
}

/**
 * Live rubric for the current session, scored from what the student has done so far.
 * TODO: replace with the model-graded rubric from the backend once it exists; teacher overrides come with it.
 */
export function scoreRubric(messages: ChatMessage[], steps: ReasoningStep[], hintsUsed: number): RubricRow[] {
  const said = messages.filter((m) => m.role === "student");
  const spoken = said.filter((m) => m.via === "voice").length;
  const broke = steps.some((s) => s.status === "broke");
  const selfCorrected = steps.some((s) => s.note?.includes("self-corrected"));
  const done = steps.filter((s) => s.status === "done").length;

  return [
    {
      id: "explain",
      label: "Explains reasoning out loud",
      score: said.length ? Math.min(RUBRIC_MAX, spoken) : null,
      why: said.length ? `${spoken} of ${said.length} answers spoken` : "Answer out loud to start",
    },
    {
      id: "correct",
      label: "Catches and fixes mistakes",
      score: selfCorrected ? 4 : broke ? 1 : null,
      why: selfCorrected ? "Found the mistake and fixed it" : broke ? "A misconception is still open" : "Nothing to fix yet",
    },
    {
      id: "physics",
      label: "Gets the physics right",
      score: said.length ? Math.min(RUBRIC_MAX, done) : null,
      why: `${done} of ${steps.length} reasoning steps complete`,
    },
    {
      id: "independent",
      label: "Works independently",
      score: said.length ? Math.max(0, RUBRIC_MAX - hintsUsed) : null,
      why: hintsUsed ? `${hintsUsed} hint${hintsUsed === 1 ? "" : "s"} used` : "No hints used",
    },
  ];
}
