import { HttpError } from "@/lib/auth";
import { recordAttempt } from "@/lib/server/attempts";
import { errorStatus, loadOwnSession, readJson } from "@/lib/server/guard";
import { checkInput, checkRate } from "@/lib/server/inputGuard";
import { streamChat } from "@/lib/server/llm";
import { EMPTY_META, parseMeta } from "@/lib/server/meta";
import { analyzeTurn } from "@/lib/server/progress";
import { buildMessages, compileSystemPrompt, META_MARKER } from "@/lib/server/prompt";
import { SSE_HEADERS, sseError, sseFrame } from "@/lib/server/sse";
import {
  canReveal,
  completeSteps,
  getMisconceptions,
  getPolicy,
  getProblem,
  getRecentTurns,
  getSolution,
  getSteps,
  incrementHints,
  loadSavedTurns,
  saveGuardEvent,
  saveMisconceptionEvent,
  saveResolvedEvent,
  saveTurn,
  setCurrentStep,
} from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE = 2000;
const SAFE_QUESTION = "Let's slow down: what do you get for each ball's acceleration if you write F = ma for both?";
const DONE_REPLY = "You've already walked through the whole chain of reasoning for this one, so there's nothing left for me to ask. Nice work, and on to the next problem!";
// A sentence ends at . ! ? or … (plus closing quotes/brackets) followed by whitespace.
const SENTENCE_END = /[.!?…]+["')\]]*\s+/g;

/**
 * POST /api/turn  { sessionId, message, via: "voice" | "text" }
 * Streams SSE: `say` { text } per sentence, then `meta`, then `done` (or `error` + `done`).
 * Policy, problem and solution are looked up here, never sent by the client (GRD-2).
 */
export async function POST(req: Request) {
  let session, message: string, via: "voice" | "text", history: { role: "student" | "tutor"; text: string }[];
  try {
    const body = await readJson(req);
    session = await loadOwnSession(body.sessionId);
    if (typeof body.message !== "string" || !body.message.trim()) throw new HttpError(400, "message is required.");
    if (body.via !== "voice" && body.via !== "text") throw new HttpError(400, 'via must be "voice" or "text".');
    message = body.message.trim().slice(0, MAX_MESSAGE);
    via = body.via;
    // The page's copy of the chat, used only to restore context after a server restart.
    history = (Array.isArray(body.history) ? body.history : []).slice(-40).flatMap((t: unknown) => {
      const m = t as { role?: unknown; text?: unknown };
      return (m.role === "student" || m.role === "tutor") && typeof m.text === "string" && m.text.trim()
        ? [{ role: m.role, text: m.text.slice(0, MAX_MESSAGE) }]
        : [];
    });
    if (via === "text" && getPolicy(session).voiceRequired) {
      throw new HttpError(400, "Your teacher asked for spoken answers on this problem. Use the mic.");
    }
    const rate = checkRate(session.userId);
    if (!rate.ok) {
      saveGuardEvent(session, { kind: "rate_limit", excerpt: message.slice(0, 200) });
      throw new HttpError(429, `You're sending messages very quickly. Take a breath and try again in ${rate.retryAfter} seconds.`);
    }
  } catch (e) {
    const { status, message } = errorStatus(e);
    return sseError(status, message);
  }

  const s = session;
  await loadSavedTurns(s, history);

  // Jailbreak and answer-hunting attempts get an in-character reply with no model call, and are logged for the teacher.
  const flagged = checkInput(message, getPolicy(s).revealAnswers || s.revealed);
  if (flagged) {
    saveGuardEvent(s, { kind: flagged.kind, excerpt: message.slice(0, 200) });
    saveTurn(s, { role: "student", text: message, via });
    saveTurn(s, { role: "tutor", text: flagged.reply });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(sseFrame("say", { text: flagged.reply }));
        controller.enqueue(sseFrame("meta", { ...EMPTY_META, completedSteps: s.completedSteps, hintsUsed: s.hintsUsed, hintLimit: getPolicy(s).hintLimit, canReveal: canReveal(s) }));
        controller.enqueue(sseFrame("done", {}));
        controller.close();
      },
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }

  // The student already showed their full reasoning: the tutor stops asking (no model call).
  if (s.completed) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(sseFrame("say", { text: DONE_REPLY }));
        controller.enqueue(sseFrame("meta", { ...EMPTY_META, reasoning_complete: true, completedSteps: s.completedSteps, hintsUsed: s.hintsUsed, hintLimit: getPolicy(s).hintLimit, canReveal: false }));
        controller.enqueue(sseFrame("done", {}));
        controller.close();
      },
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }
  const policy = getPolicy(s);
  const solution = getSolution(s);
  const steps = getSteps(s);
  const known = new Set(getMisconceptions(s).map((m) => m.id as string));
  const guardLeaks = !policy.revealAnswers && !s.revealed;

  const system = compileSystemPrompt(policy, getProblem(s), solution, getMisconceptions(s), steps);
  // Grade the whole conversation first, so the tutor knows what's done and doesn't circle back.
  const analysis = await analyzeTurn(steps, solution, getMisconceptions(s), getRecentTurns(s, 40), message);
  completeSteps(s, analysis.completed);
  const sketching = policy.tools.visualizations ? analysis.visual : null;
  const allStepsDone = s.completedSteps.length === steps.length;
  const messages = buildMessages(system, getRecentTurns(s, 16), message, {
    hintsUsed: s.hintsUsed,
    hintLimit: policy.hintLimit,
    currentStep: s.currentStep,
    completedSteps: s.completedSteps,
    steps,
    revealed: s.revealed,
    sketching,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Parameters<typeof sseFrame>[0], data: unknown) => controller.enqueue(sseFrame(event, data));
      const spoken: string[] = [];

      // Answer-leak check runs on whole sentences before they are sent (GRD-4).
      const emit = (raw: string) => {
        let text = raw.replace(/\s+/g, " ").trim();
        if (!text) return;
        if (guardLeaks && solution.finalAnswerPatterns.some((p) => p.test(text))) {
          saveGuardEvent(s, { kind: "answer_leak", excerpt: text.slice(0, 200) });
          text = SAFE_QUESTION;
          if (spoken.includes(text)) return;
        }
        spoken.push(text);
        send("say", { text });
      };

      let sentenceBuf = "";
      const feed = (text: string) => {
        sentenceBuf += text;
        let cut = 0;
        for (const m of sentenceBuf.matchAll(SENTENCE_END)) {
          emit(sentenceBuf.slice(cut, m.index! + m[0].length));
          cut = m.index! + m[0].length;
        }
        sentenceBuf = sentenceBuf.slice(cut);
      };

      // Hold back enough characters that a marker split across chunks is still found.
      let pending = "";
      let metaRaw = "";
      let inMeta = false;

      try {
        for await (const chunk of streamChat({ messages, tier: "fast" })) {
          if (inMeta) {
            metaRaw += chunk;
            continue;
          }
          pending += chunk;
          const at = pending.indexOf(META_MARKER);
          if (at >= 0) {
            feed(pending.slice(0, at));
            metaRaw = pending.slice(at + META_MARKER.length);
            pending = "";
            inMeta = true;
          } else if (pending.length >= META_MARKER.length) {
            const keep = META_MARKER.length - 1;
            feed(pending.slice(0, -keep));
            pending = pending.slice(-keep);
          }
        }
        feed(pending);
        emit(sentenceBuf);
        if (!spoken.length) {
          // The model returned no spoken text (e.g. it used its whole budget thinking). Say so instead of going silent.
          throw new Error("empty_reply");
        }

        const meta = inMeta ? parseMeta(metaRaw, known, steps.length) : { ...EMPTY_META };
        if (allStepsDone) meta.reasoning_complete = true;
        // The tutor usually drops its META block, so fill the gaps from the analysis pass.
        meta.step_assessment ??= analysis.assessment;
        meta.misconception ??= analysis.misconception;
        // A misconception the student just corrected stays cleared, even if the tutor's META re-flags it.
        if (meta.misconception && !analysis.misconception && analysis.resolved.includes(meta.misconception.id)) meta.misconception = null;
        const resolved = analysis.resolved.filter((id) => id !== meta.misconception?.id);
        if (!meta.visual_request && sketching) meta.visual_request = { primitive: "custom", params: {}, intent: sketching };
        if (meta.current_step !== null) setCurrentStep(s, meta.current_step);
        // Finishing the whole chain, or a correct answer on the last step, completes every step.
        const allDone = meta.reasoning_complete || (meta.step_assessment === "correct" && s.currentStep === steps.length - 1);
        completeSteps(s, allDone ? steps.map((_, i) => i) : meta.steps_completed);
        if (meta.reasoning_complete) s.completed = true;
        if (meta.hint_used) {
          if (s.hintsUsed < policy.hintLimit) incrementHints(s);
          else saveGuardEvent(s, { kind: "hint_limit", excerpt: spoken.join(" ").slice(0, 200) });
        }

        send("meta", {
          ...meta,
          resolved_misconceptions: resolved,
          current_step: s.currentStep,
          completedSteps: s.completedSteps,
          hintsUsed: s.hintsUsed,
          hintLimit: policy.hintLimit,
          canReveal: canReveal(s),
        });
        send("done", {});

        saveTurn(s, { role: "student", text: message, via });
        saveTurn(s, { role: "tutor", text: spoken.join(" ") });
        if (meta.misconception) saveMisconceptionEvent(s, meta.misconception.id);
        for (const id of resolved) saveResolvedEvent(s, id);
        recordAttempt(s, { misconception: meta.misconception?.id, evidence: message });
      } catch (e) {
        console.error("[/api/turn]", e);
        const detail = e instanceof Error ? e.message : "";
        send("error", {
          message: /META_API_KEY is not set/.test(detail)
            ? "The tutor model isn't configured on the server (META_API_KEY is not set)."
            : detail === "empty_reply"
              ? "Ducky didn't come up with a reply that time. Send it again?"
              : "Ducky couldn't reach the tutor model. Try again in a moment.",
        });
        send("done", {});
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
