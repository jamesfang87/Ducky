import "server-only";

/** Per-turn health of the tutor agent: latency, rough token use and how often the guard fired. In memory, last 500 turns. */
export interface TurnMetric {
  at: number;
  ms: number;
  /** Rough token estimate (characters / 4) for the prompt and the spoken reply. */
  promptTokens: number;
  replyTokens: number;
  outcome: "ok" | "blocked" | "error";
}

const g = globalThis as typeof globalThis & { __duckyMetrics?: TurnMetric[] };
const metrics: TurnMetric[] = (g.__duckyMetrics ??= []);

export const estimateTokens = (chars: number): number => Math.ceil(chars / 4);

export function recordTurnMetric(m: Omit<TurnMetric, "at">): void {
  metrics.push({ ...m, at: Date.now() });
  if (metrics.length > 500) metrics.splice(0, metrics.length - 500);
}

const pct = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0);

export function monitorSummary() {
  const modelTurns = metrics.filter((m) => m.outcome === "ok");
  const ms = modelTurns.map((m) => m.ms).sort((a, b) => a - b);
  return {
    turns: metrics.length,
    blocked: metrics.filter((m) => m.outcome === "blocked").length,
    errors: metrics.filter((m) => m.outcome === "error").length,
    p50Ms: pct(ms, 0.5),
    p95Ms: pct(ms, 0.95),
    promptTokens: modelTurns.reduce((n, m) => n + m.promptTokens, 0),
    replyTokens: modelTurns.reduce((n, m) => n + m.replyTokens, 0),
    recent: metrics.slice(-30),
  };
}
