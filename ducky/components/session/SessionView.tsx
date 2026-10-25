"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MISCONCEPTIONS, STUDENT_HISTORY } from "@/lib/mock";
import { useStore } from "@/lib/store";
import { loadChat, saveChat } from "@/lib/chatHistory";
import type { ChatMessage, MisconceptionId, ReasoningStep } from "@/lib/types";
import {
  getSessionInfo,
  requestHint,
  requestReveal,
  requestVisual,
  streamTurn,
  type SessionInfo,
  type TurnMeta,
  type VisualResult,
} from "@/lib/api";
import { AccountChip } from "@/components/ui/AccountChip";
import { Can } from "@/components/ui/Can";
import { Logo, Spinner } from "@/components/ui/icons";
import { useSession } from "@/lib/session";
import Interview from "./Interview";
import VisualPlayer from "./VisualPlayer";
import ResizeHandle from "./ResizeHandle";
import { usePersistedState } from "@/lib/usePersistedState";
import { scoreRubric } from "@/lib/rubric";
import { ExampleCard, MisconceptionTracker, ProblemCard, ReasoningPath, RubricCard } from "./SidePanels";

const uid = () => crypto.randomUUID();
const PHYSICS_IDS = new Set<string>(MISCONCEPTIONS.map((m) => m.id));

type Viz =
  | { status: "idle" }
  | { status: "loading"; topic: string }
  | { status: "ok"; title: string; frames: { svg: string; caption: string }[] }
  | { status: "message"; message: string };

export default function SessionView({ sessionId }: { sessionId: string }) {
  const session = useSession();
  const { policy, addEvent } = useStore();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [brokeAt, setBrokeAt] = useState<Set<number>>(new Set());
  const [solved, setSolved] = useState(false);
  // The student showed their full reasoning, so the tutor stops asking and the input closes.
  const [finished, setFinished] = useState(false);
  const [canReveal, setCanReveal] = useState(false);
  const [revealedStep, setRevealedStep] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [viz, setViz] = useState<Viz>({ status: "idle" });
  const [vizTopic, setVizTopic] = useState("");
  const vizBusy = useRef(false);
  // Layout prefs: visualization column width on wide screens (null = default) and whether it's minimized.
  const [vizWidth, setVizWidth] = usePersistedState<number | null>("ducky:vizWidth", null);
  const [vizMinimized, setVizMinimized] = usePersistedState("ducky:vizMinimized", false);
  const mainRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLElement>(null);
  const vizRef = useRef<HTMLElement>(null);

  const userId = session?.userId;
  // Saving starts only once the saved chat (if any) has been loaded, so the opening line never overwrites it.
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    setHistoryLoaded(false);
    Promise.all([getSessionInfo(sessionId), userId ? loadChat(userId, sessionId).catch(() => null) : null])
      .then(([i, saved]) => {
        if (!live) return;
        setInfo(i);
        setMessages(saved ?? [{ id: "m0", role: "tutor", text: i.opening }]);
        setHintsUsed(i.hintsUsed);
        setCurrentStep(i.currentStep);
        setCanReveal(i.canReveal);
        if (i.revealed) setRevealedStep(i.stepWhenHintsRanOut ?? i.currentStep);
        setFinished(i.completed);
        if (i.completed) setSolved(true);
        const base: Record<string, number> = sessionId === "demo" ? { ...STUDENT_HISTORY } : {};
        for (const m of saved ?? []) {
          if (m.flag?.kind === "misconception") {
            const id = i.misconceptions.find((x) => m.flag!.label === `Misconception flagged: ${x.label}`)?.id;
            if (id) base[id] = (base[id] ?? 0) + 1;
          }
          if (m.flag?.label === "Problem solved") setSolved(true);
          if (m.flag?.label === "Reasoning complete") {
            setSolved(true);
            setFinished(true);
          }
        }
        setCounts(base);
        setHistoryLoaded(true);
      })
      .catch((e: Error) => live && setLoadError(e.message));
    return () => {
      live = false;
    };
  }, [sessionId, userId]);

  // Persist the chat (debounced, since tutor replies stream in a sentence at a time).
  useEffect(() => {
    if (!historyLoaded || !userId || messages.length <= 1) return;
    const t = setTimeout(() => void saveChat(userId, sessionId, messages).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [messages, historyLoaded, userId, sessionId]);

  const push = (m: Omit<ChatMessage, "id">) => setMessages((ms) => [...ms, { ...m, id: uid() }]);

  const steps: ReasoningStep[] = useMemo(() => {
    if (!info) return [];
    return info.steps.map((label, i) => {
      const notes: string[] = [];
      if (brokeAt.has(i)) notes.push(i < currentStep || solved ? "Broke here, then self-corrected" : "Broke here");
      if (revealedStep === i) notes.push("Ran out of hints here; viewed the answer (no credit)");
      const note = notes.join(" · ") || undefined;
      if (solved || i < currentStep) return { label, status: "done", note };
      if (i === currentStep) return { label, status: brokeAt.has(i) || revealedStep === i ? "broke" : "current", note };
      return { label, status: "todo", note };
    });
  }, [info, currentStep, brokeAt, solved, revealedStep]);

  const showVisual = useCallback(
    async (topic: string) => {
      const t = topic.trim();
      if (!t || vizBusy.current) return;
      vizBusy.current = true;
      setViz({ status: "loading", topic: t });
      try {
        const r: VisualResult = await requestVisual(sessionId, t);
        setViz(r.status === "ok" ? { status: "ok", title: r.title, frames: r.frames } : { status: "message", message: r.message });
      } catch (e) {
        setViz({ status: "message", message: e instanceof Error ? e.message : "Couldn't make that visual." });
      } finally {
        vizBusy.current = false;
      }
    },
    [sessionId],
  );

  const applyMeta = (m: TurnMeta) => {
    if (!info) return;
    setHintsUsed(m.hintsUsed);
    setCanReveal(m.canReveal);

    if (m.misconception) {
      const id = m.misconception.id;
      const label = info.misconceptions.find((x) => x.id === id)?.label ?? id;
      push({ role: "system", text: `Misconception flagged: ${label}`, flag: { kind: "misconception", label: `Misconception flagged: ${label}` } });
      setCounts((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
      setBrokeAt((b) => new Set(b).add(m.current_step ?? currentStep));
      // The teacher heatmap only knows the physics demo's misconceptions so far.
      if (PHYSICS_IDS.has(id)) addEvent({ misconception: id as MisconceptionId, problem: info.problem.index, student: session?.name ?? "Student" });
    }

    if (m.current_step !== null && m.current_step > currentStep) {
      push({ role: "system", text: "Step complete", flag: { kind: "correct", label: brokeAt.has(currentStep) ? "Self-corrected" : "Step complete" } });
    }
    if (m.current_step !== null) setCurrentStep(m.current_step);
    if (m.step_assessment === "correct" && (m.current_step ?? currentStep) === info.steps.length - 1) {
      setSolved(true);
      push({ role: "system", text: "Problem solved", flag: { kind: "correct", label: "Problem solved" } });
    }

    if (m.reasoning_complete && !finished) {
      setFinished(true);
      setSolved(true);
      push({ role: "system", text: "Reasoning complete", flag: { kind: "correct", label: "Reasoning complete" } });
    }

    if (m.visual_request && info.visualsEnabled) void showVisual(m.visual_request.intent);
  };

  const handleSend = async (text: string, via: "voice" | "text", seconds?: number) => {
    push({ role: "student", text, via, durationSec: seconds });
    setThinking(true);
    const replyId = uid();
    let started = false;
    await streamTurn(
      { sessionId, message: text, via },
      {
        say: (sentence) => {
          setThinking(false);
          // Decide outside the updater: React runs updaters twice in dev (Strict Mode), so they must be pure.
          if (!started) {
            started = true;
            setMessages((ms) => [...ms, { id: replyId, role: "tutor", text: sentence }]);
          } else {
            setMessages((ms) => ms.map((msg) => (msg.id === replyId ? { ...msg, text: `${msg.text} ${sentence}` } : msg)));
          }
        },
        meta: applyMeta,
        error: (message) => push({ role: "system", text: message, flag: { kind: "guardrail", label: message } }),
      },
    );
    setThinking(false);
  };

  const handleHint = async () => {
    try {
      const r = await requestHint(sessionId);
      setHintsUsed(r.hintsUsed);
      setCanReveal(r.canReveal);
      if (r.hint) {
        push({ role: "system", text: `Hint ${r.hintsUsed} of ${r.hintLimit} used`, flag: { kind: "guardrail", label: "hint" } });
        push({ role: "tutor", text: r.hint });
      } else {
        push({ role: "system", text: "No hints left", flag: { kind: "guardrail", label: "No hints left for this problem" } });
      }
    } catch (e) {
      push({ role: "system", text: String(e), flag: { kind: "guardrail", label: e instanceof Error ? e.message : "Hint failed" } });
    }
  };

  const handleReveal = async () => {
    if (!window.confirm("View the answer? This problem will earn no credit.")) return;
    try {
      const r = await requestReveal(sessionId);
      setCanReveal(false);
      setRevealedStep(r.step.index);
      push({ role: "system", text: "Answer viewed, no credit", flag: { kind: "guardrail", label: "Answer viewed (no credit)" } });
      push({ role: "tutor", text: `Here's the answer: ${r.answer} Now tell me, in your own words, why that works.` });
    } catch (e) {
      push({ role: "system", text: String(e), flag: { kind: "guardrail", label: e instanceof Error ? e.message : "Couldn't show the answer" } });
    }
  };

  const rubric = useMemo(() => scoreRubric(messages, steps, hintsUsed), [messages, steps, hintsUsed]);

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md p-6 text-center">
          <p className="font-semibold">Couldn’t open this session</p>
          <p className="mt-1 text-sm text-muted">{loadError}</p>
          <Link href="/classes" className="btn mt-4 inline-flex h-10 items-center px-4 no-underline">
            Back to my classes
          </Link>
        </div>
      </div>
    );
  }
  if (!info) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted" role="status">
        <Spinner size={18} className="text-accent" /> Loading your session…
      </div>
    );
  }

  const problem = info.problem;
  const stuckLabel = revealedStep !== null ? info.steps[revealedStep] ?? null : null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-4 px-6 py-3.5">
          <Logo />
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{problem.course}</span>
            <span aria-hidden="true">/</span>
            <span>{problem.set}</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-ink">
              Problem {problem.index} of {problem.total}
            </span>
          </nav>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            {/* The tutor policy is teacher-only; students just see its effects (hint button, voice prompt). */}
            <Can allow="policy:edit">
              <span className="chip">{info.hintLimit} hints max</span>
              {info.voiceRequired && <span className="chip">Voice required</span>}
              <span className="chip">{policy.revealAnswers ? "Answers allowed" : "Answers hidden"}</span>
            </Can>
            {session?.role === "student" && (
              <Link href="/classes" className="text-sm text-sub no-underline transition hover:text-ink">
                My classes
              </Link>
            )}
            <Can allow="class:view">
              <Link href="/teacher" className="text-sm text-sub no-underline transition hover:text-ink">
                Teacher view
              </Link>
            </Can>
            <AccountChip />
          </div>
        </div>
      </header>

      <main ref={mainRef} className="mx-auto flex max-w-[1360px] flex-wrap items-start gap-5 p-6 xl:flex-nowrap">
        <section ref={leftRef} aria-label="Problem and progress" className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
          <ProblemCard problem={problem} />
          <ReasoningPath steps={steps} />
          {canReveal && (
            <div className="card p-5">
              <p className="font-semibold">Out of hints?</p>
              <p className="mt-1 text-sm text-muted">You can see the answer, but this problem won’t count for credit.</p>
              <button type="button" className="btn mt-3 h-9 px-3 text-sm" onClick={handleReveal}>
                View answer (no credit)
              </button>
            </div>
          )}
          <MisconceptionTracker
            counts={counts}
            items={sessionId === "demo" ? undefined : info.misconceptions}
            stuckStep={stuckLabel}
          />
          <RubricCard rows={rubric} messages={messages} />
        </section>

        <Interview
          messages={messages}
          thinking={thinking}
          hintsUsed={hintsUsed}
          hintLimit={info.hintLimit}
          voiceRequired={info.voiceRequired}
          finished={finished}
          onSend={handleSend}
          onHint={handleHint}
        />

        {vizMinimized ? (
          <section aria-label="Visualization (minimized)" className="flex-[1_1_100%] xl:flex-none">
            <button
              type="button"
              onClick={() => setVizMinimized(false)}
              className="card flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold transition hover:border-accent xl:h-60 xl:w-14 xl:flex-col xl:px-0 xl:py-4"
            >
              <VizIcon size={22} />
              <span className="xl:[writing-mode:vertical-rl]">Show visualization</span>
              {viz.status === "loading" && <Spinner size={14} className="ml-auto text-accent xl:ml-0" />}
              {viz.status === "ok" && (
                <span className="ml-auto h-2 w-2 rounded-full bg-accent xl:ml-0">
                  <span className="sr-only">(a visual is ready)</span>
                </span>
              )}
            </button>
          </section>
        ) : (
          <>
            <ResizeHandle
              orientation="vertical"
              label="Resize chat and visualization"
              invert
              className="hidden xl:-mx-3 xl:flex"
              measure={() => vizRef.current?.getBoundingClientRect().width ?? 420}
              min={320}
              // Leave the chat at least 360px next to the problem column.
              max={() => Math.max(320, (mainRef.current?.clientWidth ?? 1360) - 48 - (leftRef.current?.offsetWidth ?? 280) - 360 - 40)}
              onResize={setVizWidth}
              onReset={() => setVizWidth(null)}
            />

            <section
              ref={vizRef}
              aria-label="Visualization"
              style={vizWidth ? ({ "--viz-w": `${vizWidth}px` } as React.CSSProperties) : undefined}
              className={`flex min-w-0 flex-[2_1_420px] flex-col gap-4 ${vizWidth ? "xl:w-[var(--viz-w)] xl:flex-none" : ""}`}
            >
              <div className="-mb-2 flex items-center justify-between gap-2 px-1">
                <p className="eyebrow">Visualization</p>
                <button type="button" className="text-sm text-sub transition hover:text-ink" onClick={() => setVizMinimized(true)}>
                  Minimize
                </button>
              </div>
              {viz.status === "loading" ? (
                <div className="card flex min-h-[300px] flex-col items-center justify-center gap-2 p-8 text-center" role="status">
                  <Spinner size={18} className="text-accent" />
                  <p className="font-semibold">Ducky is sketching it…</p>
                  <p className="max-w-[320px] text-sm text-muted">“{viz.topic}”. This can take up to half a minute.</p>
                </div>
              ) : viz.status === "ok" ? (
                <VisualPlayer title={viz.title} frames={viz.frames} onClose={() => setViz({ status: "idle" })} />
              ) : (
                <div className="card flex min-h-[300px] flex-col items-center justify-center gap-2 p-8 text-center">
                  <VizIcon size={40} />
                  <p className="font-semibold">{viz.status === "message" ? viz.message : "Want to see it?"}</p>
                  {info.visualsEnabled ? (
                    <>
                      <p className="max-w-[320px] text-sm text-muted">
                        Ask in the chat (“can you show me?”) or describe what you want to see from this problem.
                      </p>
                      <form
                        className="mt-2 flex w-full max-w-[380px] gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void showVisual(vizTopic || info.steps[currentStep] || problem.prompt);
                        }}
                      >
                        <input
                          value={vizTopic}
                          onChange={(e) => setVizTopic(e.target.value)}
                          maxLength={300}
                          placeholder={info.steps[currentStep] ?? "What should Ducky draw?"}
                          aria-label="What should Ducky draw?"
                          className="h-10 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm"
                        />
                        <button type="submit" className="btn-primary h-10 flex-none px-3 text-sm">
                          Show me visually
                        </button>
                      </form>
                    </>
                  ) : (
                    <p className="max-w-[300px] text-sm text-muted">Your teacher turned visuals off for this assignment.</p>
                  )}
                </div>
              )}
              {sessionId === "demo" && solved && policy.tools.webExamples && <ExampleCard />}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function VizIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" className="flex-none">
      <rect x="4" y="8" width="32" height="24" rx="4" stroke="#C9CCC6" strokeWidth="2" />
      <path d="M10 26l7-8 5 5 4-4 4 7" stroke="#0B7A62" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
