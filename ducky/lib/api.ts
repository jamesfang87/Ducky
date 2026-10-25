/**
 * Browser client for the tutoring API (app/api/*). Every call sends only the
 * session id and what the student did; policy and solutions stay on the server.
 */
import type { Problem } from "./types";

export interface SessionInfo {
  problem: Problem;
  opening: string;
  steps: string[];
  currentStep: number;
  completedSteps: number[];
  misconceptions: { id: string; label: string }[];
  hintsUsed: number;
  hintLimit: number;
  voiceRequired: boolean;
  visualsEnabled: boolean;
  resourcesEnabled: boolean;
  canReveal: boolean;
  revealed: boolean;
  completed: boolean;
  stepWhenHintsRanOut: number | null;
}

export interface TurnMeta {
  step_assessment: "correct" | "partial" | "incorrect" | "off_task" | null;
  misconception: { id: string; evidence: string; confidence: number } | null;
  /** Misconceptions flagged earlier that the student has now corrected. */
  resolved_misconceptions?: string[];
  visual_request: { primitive: string; params: Record<string, unknown>; intent: string } | null;
  hint_used: boolean;
  wants_web_example: string | null;
  current_step: number | null;
  steps_completed: number[];
  reasoning_complete: boolean;
  /** Every step done so far, after this turn (server's record). */
  completedSteps: number[];
  hintsUsed: number;
  hintLimit: number;
  canReveal: boolean;
}

export interface HintResult {
  hint: string | null;
  hintsUsed: number;
  hintLimit: number;
  canReveal: boolean;
}

export interface RevealResult {
  answer: string;
  credit: 0;
  step: { index: number; label: string };
  hintsUsed: number;
  hintLimit: number;
}

export type VisualResult =
  | { status: "ok"; title: string; frames: { svg: string; caption: string }[] }
  | { status: "declined" | "failed"; message: string };

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

const post = (path: string, body: unknown) =>
  fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const getSessionInfo = (sessionId: string) =>
  fetch(`/api/session?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" }).then((r) => json<SessionInfo>(r));

export const requestHint = (sessionId: string) => post("/api/hint", { sessionId }).then((r) => json<HintResult>(r));

export const requestReveal = (sessionId: string) => post("/api/reveal", { sessionId }).then((r) => json<RevealResult>(r));

export interface Resource {
  title: string;
  snippet: string;
  source: string;
  link: string;
}

export const findResources = (sessionId: string, topic?: string) =>
  post("/api/resources", { sessionId, topic }).then((r) => json<{ query: string; resources: Resource[] }>(r));

export const requestVisual = (sessionId: string, topic: string) =>
  post("/api/visual", { sessionId, topic }).then((r) => json<VisualResult>(r));

/** POST /api/turn and dispatch its Server-Sent Events as they arrive. Resolves after `done`. */
export async function streamTurn(
  body: { sessionId: string; message: string; via: "voice" | "text"; history?: { role: "student" | "tutor"; text: string }[] },
  on: { say: (text: string) => void; meta: (m: TurnMeta) => void; error: (message: string) => void },
): Promise<void> {
  let res: Response;
  try {
    res = await post("/api/turn", body);
  } catch {
    on.error("Couldn't reach Ducky. Check your connection and try again.");
    return;
  }
  if (!res.body) {
    on.error("Ducky didn't answer. Try again.");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, end);
      buf = buf.slice(end + 2);
      const event = /^event: (.+)$/m.exec(frame)?.[1];
      const data = /^data: (.*)$/m.exec(frame)?.[1];
      if (!event || data === undefined) continue;
      const payload = JSON.parse(data);
      if (event === "say") on.say(payload.text);
      else if (event === "meta") on.meta(payload);
      else if (event === "error") on.error(payload.message);
      else if (event === "done") return;
    }
  }
}
