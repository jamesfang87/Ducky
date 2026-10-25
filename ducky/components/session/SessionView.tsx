"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MISCONCEPTIONS, STUDENT_HISTORY } from "@/lib/mock";
import { findProblemSetBySession } from "@/lib/problemSets";
import { useStore } from "@/lib/store";
import { clearLocalChat, loadChat, saveChat } from "@/lib/chatHistory";
import type { ChatMessage, MisconceptionId, ReasoningStep } from "@/lib/types";
import {
  findResources,
  getSessionInfo,
  requestHint,
  requestReveal,
  requestVisual,
  resetSession,
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
import { DuckyRadioButton } from "./DuckyRadio";
import { ProofOfThinkingCard } from "./ProofOfThinking";
import RaiseHand from "./RaiseHand";
import VisualPlayer from "./VisualPlayer";
import ResizeHandle from "./ResizeHandle";
import { usePersistedState } from "@/lib/usePersistedState";
import { scoreRubric } from "@/lib/rubric";
import { ExampleCard, MisconceptionTracker, ProblemCard, ReasoningPath, ResourcesCard, RubricCard, type ResourcesState } from "./SidePanels";

const uid = () => crypto.randomUUID();
const PHYSICS_IDS = new Set<string>(MISCONCEPTIONS.map((m) => m.id));
/** Prefix of the chat flag for a finished step; the label after it restores the checklist on reload. */
const STEP_DONE = "Step complete: ";
const CORRECTED = "Misconception corrected: ";

type Viz =
  | { status: "idle" }
  | { status: "loading"; topic: string }
  | { status: "ok"; title: string; frames: { svg: string; caption: string }[] }
  | { status: "message"; message: string };

export default function SessionView({ sessionId }: { sessionId: string }) {
  const session = useSession();
  const { policy, addEvent } = useStore();
  // The mock set catalog tells the breadcrumb where the course and set live.
  const problemSet = findProblemSetBySession(sessionId);
  const setIndex = problemSet ? problemSet.sessionIds.indexOf(sessionId) : -1;
  const nextSessionId =
    problemSet && setIndex >= 0 && setIndex < problemSet.sessionIds.length - 1
      ? problemSet.sessionIds[setIndex + 1]
      : null;
  const problemSetHref = problemSet ? `/classes/${problemSet.classId}#${problemSet.id}` : undefined;
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  // True until Ducky's whole turn has streamed, so voice mode knows not to reopen the mic mid-reply.
  const [responding, setResponding] = useState(false);
  // Identifies the current turn; stale streams from an interrupted turn stop updating the UI.
  const turnSeq = useRef(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  // Reasoning steps the student has explained correctly, so the checklist fills in as they go.
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  // Misconceptions still open, by id, with the step they broke; a later correction clears them.
  const [openFlags, setOpenFlags] = useState<Record<string, number>>({});
  const [correctedAt, setCorrectedAt] = useState<Set<number>>(new Set());
  const brokeAt = useMemo(() => new Set(Object.values(openFlags)), [openFlags]);
  const [solved, setSolved] = useState(false);
  // The student showed their full reasoning, so the tutor stops asking and the input closes.
  const [finished, setFinished] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [canReveal, setCanReveal] = useState(false);
  const [revealedStep, setRevealedStep] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [viz, setViz] = useState<Viz>({ status: "idle" });
  const [vizTopic, setVizTopic] = useState("");
  const [resources, setResources] = useState<ResourcesState>({ status: "idle" });
  const vizBusy = useRef(false);
  // Layout prefs: sidebar and visualization column widths on wide screens, as a percent of the
  // window so the panes scale with it (null = default), and whether the visual is minimized.
  const [sidePct, setSidePct] = usePersistedState<number | null>("ducky:sidePct", null);
  const [vizPct, setVizPct] = usePersistedState<number | null>("ducky:vizPct", null);
  const [vizMinimized, setVizMinimized] = usePersistedState("ducky:vizMinimized", false);
  const [vizFull, setVizFull] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const vizRef = useRef<HTMLElement>(null);
  const vizBoxRef = useRef<HTMLDivElement>(null);

  // Width of the pane row in px, without its padding.
  const rowWidth = () => {
    const el = mainRef.current;
    if (!el) return 1200;
    const s = getComputedStyle(el);
    return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
  };
  const toPct = (px: number) => (px / rowWidth()) * 100;
  // Whatever the sidebar and visual leave over is the chat's; keep it at least this wide.
  const CHAT_MIN = 340 + 2 * 20;

  const exitFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setVizFull(false);
  }, []);

  const toggleFull = () => {
    if (vizFull) return exitFull();
    setVizFull(true);
    // The fixed overlay alone covers the window where the Fullscreen API isn't available (iOS).
    vizBoxRef.current?.requestFullscreen?.().catch(() => {});
  };

  // Esc leaves full screen. In browser full screen the browser eats the key and fires
  // fullscreenchange instead; in the overlay fallback the keydown arrives (captured first).
  useEffect(() => {
    if (!vizFull) return;
    const onChange = () => !document.fullscreenElement && setVizFull(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      exitFull();
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [vizFull, exitFull]);

  const userId = session?.userId;
  // Saving starts only once the saved chat (if any) has been loaded, so the opening line never overwrites it.
  const [historyLoaded, setHistoryLoaded] = useState(false);
  // Bumped to re-run the session loader after a reset.
  const [reloadKey, setReloadKey] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  // Tells the voice panel to stop talking and leave hands-free mode.
  const [resetToken, setResetToken] = useState(0);
  // Suppress chat saves while a reset is deleting the old transcript.
  const resettingRef = useRef(false);

  useEffect(() => {
    let live = true;
    turnSeq.current += 1;
    setHistoryLoaded(false);
    setLoadError(null);
    setInfo(null);
    setMessages([]);
    setThinking(false);
    setResponding(false);
    setHintsUsed(0);
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setOpenFlags({});
    setCorrectedAt(new Set());
    setSolved(false);
    setFinished(false);
    setWrong(false);
    setCanReveal(false);
    setRevealedStep(null);
    setCounts({});
    setViz({ status: "idle" });
    setVizTopic("");
    setResources({ status: "idle" });
    vizBusy.current = false;
    Promise.all([
      getSessionInfo(sessionId),
      userId && !resettingRef.current ? loadChat(userId, sessionId).catch(() => null) : null,
    ])
      .then(([i, saved]) => {
        if (!live) return;
        setInfo(i);
        setMessages(saved ?? [{ id: "m0", role: "tutor", text: i.opening }]);
        setHintsUsed(i.hintsUsed);
        setCurrentStep(i.currentStep);
        // The server forgets progress on restart; the saved chat's step flags fill it back in.
        const done = new Set(i.completedSteps);
        for (const m of saved ?? []) {
          const label = m.flag?.kind === "correct" && m.text.startsWith(STEP_DONE) ? m.text.slice(STEP_DONE.length) : null;
          const idx = label === null ? -1 : i.steps.indexOf(label);
          if (idx >= 0) done.add(idx);
        }
        setCompletedSteps(done);
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
          if (m.flag?.kind === "correct" && m.text.startsWith(CORRECTED)) {
            const id = i.misconceptions.find((x) => m.text === `${CORRECTED}${x.label}`)?.id;
            if (id && base[id]) base[id] -= 1;
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
      .catch((e: Error) => live && setLoadError(e.message))
      .finally(() => {
        resettingRef.current = false;
      });
    return () => {
      live = false;
    };
  }, [sessionId, userId, reloadKey]);

  // Persist the chat (debounced, since tutor replies stream in a sentence at a time).
  useEffect(() => {
    if (!historyLoaded || !userId || messages.length <= 1 || resettingRef.current) return;
    const t = setTimeout(() => {
      if (resettingRef.current) return;
      void saveChat(userId, sessionId, messages).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [messages, historyLoaded, userId, sessionId]);

  const push = (m: Omit<ChatMessage, "id">) => setMessages((ms) => [...ms, { ...m, id: uid() }]);

  const steps: ReasoningStep[] = useMemo(() => {
    if (!info) return [];
    return info.steps.map((label, i) => {
      const notes: string[] = [];
      const done = solved || completedSteps.has(i);
      if (correctedAt.has(i) || (done && brokeAt.has(i))) notes.push("Broke here, then self-corrected");
      else if (brokeAt.has(i)) notes.push("Broke here");
      if (revealedStep === i) notes.push("Ran out of hints here; viewed the answer (no credit)");
      const note = notes.join(" · ") || undefined;
      if (done) return { label, status: "done", note };
      if (i === currentStep) return { label, status: brokeAt.has(i) || revealedStep === i ? "broke" : "current", note };
      return { label, status: "todo", note };
    });
  }, [info, currentStep, completedSteps, brokeAt, correctedAt, solved, revealedStep]);

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

  const searchResources = useCallback(
    async (topic?: string) => {
      setResources({ status: "loading" });
      try {
        const r = await findResources(sessionId, topic);
        setResources({ status: "ok", ...r });
      } catch (e) {
        setResources({ status: "error", message: e instanceof Error ? e.message : "Couldn't search right now." });
      }
    },
    [sessionId],
  );

  const applyMeta = (m: TurnMeta) => {
    if (!info) return;
    // Ducky looks sad after a wrong step, until a later turn gets it right.
    setWrong(Boolean(m.misconception) || m.step_assessment === "incorrect");
    setHintsUsed(m.hintsUsed);
    setCanReveal(m.canReveal);

    if (m.misconception) {
      const id = m.misconception.id;
      const label = info.misconceptions.find((x) => x.id === id)?.label ?? id;
      push({ role: "system", text: `Misconception flagged: ${label}`, flag: { kind: "misconception", label: `Misconception flagged: ${label}` } });
      setCounts((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
      setOpenFlags((f) => ({ ...f, [id]: m.current_step ?? currentStep }));
      // The teacher heatmap only knows the physics demo's misconceptions so far.
      if (PHYSICS_IDS.has(id)) addEvent({ misconception: id as MisconceptionId, problem: info.problem.index, student: session?.name ?? "Student" });
    }

    // Corrected later on (or the step it broke is now done): un-flag it, so it neither counts
    // against them nor leaves the step broken.
    const nowDone = new Set(m.completedSteps);
    const resolved = new Set(m.resolved_misconceptions ?? []);
    const fixed = Object.entries(openFlags)
      .filter(([id, step]) => id !== m.misconception?.id && (resolved.has(id) || (nowDone.has(step) && !completedSteps.has(step))))
      .map(([id]) => id);
    if (fixed.length) {
      setOpenFlags((f) => Object.fromEntries(Object.entries(f).filter(([id]) => !fixed.includes(id))));
      setCorrectedAt((c) => new Set([...c, ...fixed.map((id) => openFlags[id])]));
      setCounts((c) => ({ ...c, ...Object.fromEntries(fixed.map((id) => [id, Math.max(0, (c[id] ?? 0) - 1)])) }));
      for (const id of fixed) {
        const label = info.misconceptions.find((x) => x.id === id)?.label ?? id;
        push({ role: "system", text: `${CORRECTED}${label}`, flag: { kind: "correct", label: `${CORRECTED}${label}` } });
      }
    }

    for (const i of m.completedSteps) {
      if (completedSteps.has(i)) continue;
      const label = info.steps[i];
      push({ role: "system", text: `${STEP_DONE}${label}`, flag: { kind: "correct", label: brokeAt.has(i) || correctedAt.has(i) ? `Self-corrected: ${label}` : `${STEP_DONE}${label}` } });
    }
    setCompletedSteps(nowDone);
    if (m.current_step !== null) setCurrentStep(m.current_step);
    if (!solved && info.steps.every((_, i) => nowDone.has(i))) {
      setSolved(true);
      push({ role: "system", text: "Problem solved", flag: { kind: "correct", label: "Problem solved" } });
    }

    if (m.reasoning_complete && !finished) {
      setFinished(true);
      setSolved(true);
      push({ role: "system", text: "Reasoning complete", flag: { kind: "correct", label: "Reasoning complete" } });
    }

    if (m.visual_request && info.visualsEnabled) void showVisual(m.visual_request.intent);
    if (m.wants_web_example && info.resourcesEnabled) void searchResources(m.wants_web_example);
  };

  const handleSend = async (text: string, via: "voice" | "text", seconds?: number) => {
    const seq = ++turnSeq.current;
    push({ role: "student", text, via, durationSec: seconds });
    setThinking(true);
    setResponding(true);
    const replyId = uid();
    let started = false;
    try {
      await streamTurn(
        {
          sessionId,
          message: text,
          via,
          history: messages.flatMap((m) => (m.role === "student" || m.role === "tutor" ? [{ role: m.role, text: m.text }] : [])).slice(-40),
        },
        {
          say: (sentence) => {
            if (seq !== turnSeq.current) return;
            setThinking(false);
            // Decide outside the updater: React runs updaters twice in dev (Strict Mode), so they must be pure.
            if (!started) {
              started = true;
              setMessages((ms) => [...ms, { id: replyId, role: "tutor", text: sentence }]);
            } else {
              setMessages((ms) => ms.map((msg) => (msg.id === replyId ? { ...msg, text: `${msg.text} ${sentence}` } : msg)));
            }
          },
          meta: (m) => {
            if (seq === turnSeq.current) applyMeta(m);
          },
          error: (message) => {
            if (seq === turnSeq.current) push({ role: "system", text: message, flag: { kind: "guardrail", label: message } });
          },
        },
      );
    } finally {
      if (seq === turnSeq.current) {
        setThinking(false);
        setResponding(false);
      }
    }
  };

  /** Clear this one question; other questions and their chats stay untouched. */
  const handleReset = async () => {
    if (resetting) return;
    const ok = window.confirm(
      "Clear your progress on this question? Your chat, hints, and completed steps for this question will be removed. Other questions are not affected.",
    );
    if (!ok) return;

    setResetting(true);
    setResetError(null);
    resettingRef.current = true;
    turnSeq.current += 1; // drop any reply that is still streaming
    try {
      await resetSession(sessionId);
      if (userId) clearLocalChat(userId, sessionId);
      setResetToken((n) => n + 1);
      setReloadKey((k) => k + 1);
    } catch (e) {
      resettingRef.current = false;
      setResetError(e instanceof Error ? e.message : "Couldn't clear progress.");
    } finally {
      setResetting(false);
    }
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
    <div className="flex min-h-screen flex-col lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
      <header className="flex-none border-b border-line bg-surface">
        <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
          <Logo />
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {problemSet ? (
              <Link href={`/classes/${problemSet.classId}`} className="text-muted no-underline transition hover:text-ink">
                {problem.course}
              </Link>
            ) : (
              <span>{problem.course}</span>
            )}
            <span aria-hidden="true">/</span>
            {problemSetHref ? (
              <Link href={problemSetHref} className="text-muted no-underline transition hover:text-ink">
                {problem.set}
              </Link>
            ) : (
              <span>{problem.set}</span>
            )}
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-ink" aria-current="page">
              Problem {problem.index} of {problem.total}
            </span>
          </nav>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            {/* The tutor policy is teacher-only; students just see its effects (hint button, voice prompt). */}
            <Can allow="policy:edit">
              <span className="chip">{info.hintLimit} hints max</span>
              {info.voiceRequired && <span className="chip">Voice required</span>}
              <span className="chip">{info.revealAfterHints ? "Answer after hints" : "Answers hidden"}</span>
            </Can>
            {info.nextSessionId && (
              <Link href={`/session/${info.nextSessionId}`} className="text-sm font-semibold text-accent no-underline transition hover:text-accent-dark">
                Next problem →
              </Link>
            )}
            {session && (
              <Link href="/classes" className="text-sm text-sub no-underline transition hover:text-ink">
                My classes
              </Link>
            )}
            {session && (
              <Link href="/classes/history" className="text-sm text-sub no-underline transition hover:text-ink">
                Past sets
              </Link>
            )}
            <Can allow="class:view">
              <Link href="/teacher" className="text-sm text-sub no-underline transition hover:text-ink">
                Teacher view
              </Link>
            </Can>
            <DuckyRadioButton
              progress={info.steps.length ? completedSteps.size / info.steps.length : 0}
              tension={Object.keys(openFlags).length > 0}
              done={solved || finished}
            />
            <AccountChip />
          </div>
        </div>
      </header>

      {/* From 1024px the panes fill the window below the header and share one bottom edge;
          each pane scrolls on its own. Narrower screens stack them and scroll the page. */}
      <main ref={mainRef} className="flex flex-col gap-5 p-5 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-0">
        <section
          ref={sideRef}
          aria-label="Problem and progress"
          style={{ "--side-w": `${sidePct ?? 24}%` } as React.CSSProperties}
          className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:min-w-[220px] lg:flex-[0_1_var(--side-w)] lg:overflow-y-auto [&>*]:flex-none lg:[&>:last-child]:flex-auto"
        >
          <ProblemCard
            problem={problem}
            nextHref={nextSessionId ? `/session/${nextSessionId}` : undefined}
            backHref={problemSetHref}
            onReset={session ? handleReset : undefined}
            resetting={resetting}
            resetError={resetError}
          />
          {info.resourcesEnabled && <ResourcesCard state={resources} onSearch={(t) => void searchResources(t)} />}
          {canReveal && (
            <div className="card p-5">
              <p className="font-semibold">Out of hints?</p>
              <p className="mt-1 text-sm text-muted">You can see the answer, but this problem won’t count for credit.</p>
              <button type="button" className="btn mt-3 h-9 px-3 text-sm" onClick={handleReveal}>
                View answer (no credit)
              </button>
            </div>
          )}
          {sessionId !== "demo" && <RaiseHand sessionId={sessionId} />}
          <MisconceptionTracker
            counts={counts}
            items={sessionId === "demo" ? undefined : info.misconceptions}
            stuckStep={stuckLabel}
          />
          <RubricCard rows={rubric} messages={messages} />
          <ProofOfThinkingCard
            student={session?.name ?? "Student"}
            course={problem.course}
            set={problem.set}
            problem={`Problem ${problem.index} of ${problem.total}`}
            messages={messages}
            steps={steps}
            hintsUsed={hintsUsed}
            hintLimit={info.hintLimit}
            revealed={revealedStep !== null}
          />
        </section>

        <ResizeHandle
          orientation="vertical"
          label="Resize sidebar"
          className="hidden lg:flex"
          measure={() => sideRef.current?.getBoundingClientRect().width ?? 300}
          min={220}
          max={() => Math.max(220, rowWidth() - (vizRef.current?.getBoundingClientRect().width ?? 0) - CHAT_MIN)}
          onResize={(px) => setSidePct(toPct(px))}
          onReset={() => setSidePct(null)}
        />

        <Interview
          messages={messages}
          thinking={thinking}
          responding={responding}
          resetToken={resetToken}
          hintsUsed={hintsUsed}
          hintLimit={info.hintLimit}
          voiceRequired={info.voiceRequired}
          finished={finished}
          wrong={wrong && !finished}
          onSend={handleSend}
          onHint={handleHint}
        />

        <ResizeHandle
          orientation="vertical"
          label="Resize chat and visualization"
          invert
          className="hidden lg:flex"
          measure={() => vizRef.current?.getBoundingClientRect().width ?? 420}
          min={280}
          max={() => Math.max(280, rowWidth() - (sideRef.current?.getBoundingClientRect().width ?? 0) - CHAT_MIN)}
          onResize={(px) => setVizPct(toPct(px))}
          onReset={() => setVizPct(null)}
        />

        {/* Visualization on top, reasoning path below it. */}
        <section
          ref={vizRef}
          aria-label="Visualization and reasoning path"
          style={{ "--viz-w": `${vizPct ?? 34}%` } as React.CSSProperties}
          className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:min-w-[280px] lg:flex-[0_1_var(--viz-w)]"
        >
          {vizMinimized ? (
            <button
              type="button"
              onClick={() => setVizMinimized(false)}
              className="card flex w-full flex-none items-center gap-2.5 px-4 py-3 text-sm font-semibold transition hover:border-accent"
            >
              <VizIcon size={22} />
              Show visualization
              {viz.status === "loading" && <Spinner size={14} className="ml-auto text-accent" />}
              {viz.status === "ok" && (
                <span className="ml-auto h-2 w-2 rounded-full bg-accent">
                  <span className="sr-only">(a visual is ready)</span>
                </span>
              )}
            </button>
          ) : (
            <div
              ref={vizBoxRef}
              role={vizFull ? "dialog" : undefined}
              aria-label={vizFull ? "Visualization, full screen" : undefined}
              className={
                vizFull
                  ? "fixed inset-0 z-50 flex flex-col bg-ground p-4"
                  : "flex h-[min(70vh,560px)] flex-col lg:h-auto lg:min-h-0 lg:flex-[1_1_60%]"
              }
            >
              <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex flex-none items-center gap-3 border-b border-line px-5 py-2.5">
                  <p className="eyebrow">Visualization</p>
                  <div className="flex-1" />
                  {!vizFull && (
                    <button type="button" className="text-sm text-sub transition hover:text-ink" onClick={() => setVizMinimized(true)}>
                      Minimize
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleFull}
                    aria-label={vizFull ? "Exit full screen" : "Full screen"}
                    title={vizFull ? "Exit full screen (Esc)" : "Full screen"}
                    className="-mr-2 flex h-8 w-8 items-center justify-center rounded-md text-sub transition hover:bg-ground hover:text-ink"
                  >
                    <FullScreenIcon exit={vizFull} />
                  </button>
                </div>
                {viz.status === "loading" ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center" role="status">
                    <Spinner size={18} className="text-accent" />
                    <p className="font-semibold">Ducky is sketching it…</p>
                    <p className="max-w-[320px] text-sm text-muted">“{viz.topic}”. This can take up to half a minute.</p>
                  </div>
                ) : viz.status === "ok" ? (
                  <div className="min-h-0 flex-1">
                    <VisualPlayer title={viz.title} frames={viz.frames} onClose={() => setViz({ status: "idle" })} />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 overflow-y-auto p-8 text-center">
                    <VizIcon size={40} />
                    <p className="font-semibold">{viz.status === "message" ? viz.message : "Want to see it?"}</p>
                    {info.visualsEnabled ? (
                      <>
                        <p className="max-w-[320px] text-sm text-muted">
                          Ask in the chat (“can you show me?”) or describe what you want to see from this problem.
                        </p>
                        <form
                          className="mt-2 flex w-full max-w-[380px] flex-col gap-2.5"
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
                            className="h-11 w-full rounded-lg border border-line px-3 text-sm"
                          />
                          <button type="submit" className="btn-primary h-11 w-full px-3 text-sm">
                            Show me visually
                          </button>
                        </form>
                      </>
                    ) : (
                      <p className="max-w-[300px] text-sm text-muted">Your teacher turned visuals off for this assignment.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          {sessionId === "demo" && solved && policy.tools.webExamples && (
            <div className="flex-none">
              <ExampleCard />
            </div>
          )}
          {/* Takes the whole column while the visual is minimized; otherwise up to 40% of it, scrolling past that. */}
          <ReasoningPath
            steps={steps}
            className={vizMinimized ? "lg:min-h-0 lg:flex-1 lg:overflow-y-auto" : "flex-none lg:max-h-[40%] lg:overflow-y-auto"}
          />
        </section>
      </main>
    </div>
  );
}

/** The standard ⛶ corner-brackets glyph; the brackets point inward to exit. */
function FullScreenIcon({ exit }: { exit: boolean }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {exit ? (
        <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      ) : (
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      )}
    </svg>
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
