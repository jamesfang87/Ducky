import "server-only";

/**
 * Input guard (GRD-3) and per-student rate limit (GRD-5).
 *
 * The guard is a fast heuristic pass that runs before any model call. It catches the common
 * jailbreak and answer-hunting phrasings, answers in Ducky's voice, and logs the attempt for the
 * teacher. It is not the only defense: the tutor prompt and the output guard (GRD-4) still apply.
 */

export type InputFlag = { kind: "jailbreak" | "answer_hunt"; reply: string };

const JAILBREAK: RegExp[] = [
  /ignore (all |any |your |the )?(previous|prior|above|earlier) (instructions|rules|prompt)/i,
  /(disregard|forget|override) (all |any |your |the )?(previous |prior )?(instructions|rules|prompt|guidelines)/i,
  /(reveal|show|print|repeat|tell me) (me )?(your |the )?(system|hidden|initial) (prompt|instructions)/i,
  /you are (now )?(dan|an? unrestricted|no longer)/i,
  /pretend (you('| a)?re|to be) (not|an? (different|unrestricted))/i,
  /(developer|debug|admin|teacher) mode/i,
  /(the )?teacher (said|says|told me|allows|allowed|approved)[^.]{0,40}(answer|solution)/i,
  /\bjailbreak\b/i,
];

const ANSWER_HUNT: RegExp[] = [
  /\b(just )?(give|tell|show|send) me (the )?(final |full |correct |actual )?(answer|solution|result)\b/i,
  /\bwhat('| i)?s the (final |correct )?(answer|solution)\b/i,
  /\bskip (the |all )?(explanation|reasoning|questions|steps)\b/i,
  /\b(solve|do) (it|this|the (problem|whole thing)) for me\b/i,
  /\bi (don'?t|do not) (want|need) (to explain|an? explanation|hints?)\b[^.]*\banswer\b/i,
  /\bwrite (out )?the (full |complete )?solution\b/i,
];

const REPLIES = {
  jailbreak: "Nice try. I can't change my rules, but I can still help you get there. What's the first thing you know about this problem?",
  answer_hunt: "I won't hand over the answer, but I'll get you there. Tell me what you think happens first, and why.",
};

export function checkInput(message: string, allowAnswers: boolean): InputFlag | null {
  const text = message.slice(0, 2000);
  if (JAILBREAK.some((re) => re.test(text))) return { kind: "jailbreak", reply: REPLIES.jailbreak };
  if (!allowAnswers && ANSWER_HUNT.some((re) => re.test(text))) return { kind: "answer_hunt", reply: REPLIES.answer_hunt };
  return null;
}

// Per-student sliding window: 20 turns a minute, 120 an hour. Kept in memory like the rest of the tutor state.
const g = globalThis as typeof globalThis & { __duckyRate?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__duckyRate ??= new Map<string, number[]>());
const MINUTE = { limit: 20, ms: 60_000 };
const HOUR = { limit: 120, ms: 3_600_000 };

/** Records a turn for this student and says whether it is allowed. `retryAfter` is in seconds. */
export function checkRate(userId: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
  const list = (hits.get(userId) ?? []).filter((t) => now - t < HOUR.ms);
  for (const w of [MINUTE, HOUR]) {
    const inWindow = list.filter((t) => now - t < w.ms);
    if (inWindow.length >= w.limit) {
      hits.set(userId, list);
      return { ok: false, retryAfter: Math.ceil((inWindow[0] + w.ms - now) / 1000) };
    }
  }
  list.push(now);
  hits.set(userId, list);
  return { ok: true };
}
