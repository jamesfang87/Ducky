"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HINTS, INITIAL_STEPS, MISCONCEPTIONS, PROBLEM, STUDENT_HISTORY, STUDENT_NAME } from "@/lib/mock";
import { useStore } from "@/lib/store";
import { getTutorReply, runVizPipeline } from "@/lib/tutor";
import type { ChatMessage, MisconceptionId, PipelineEvent, ReasoningStep } from "@/lib/types";
import { AccountChip } from "@/components/ui/AccountChip";
import { Can } from "@/components/ui/Can";
import { Logo } from "@/components/ui/icons";
import { useSession } from "@/lib/session";
import FreeFallViz from "./FreeFallViz";
import Interview from "./Interview";
import ReviewerLoop from "./ReviewerLoop";
import { ExampleCard, MisconceptionTracker, ProblemCard, ReasoningPath } from "./SidePanels";

const uid = () => crypto.randomUUID();

const OPENING: ChatMessage = {
  id: "m0",
  role: "tutor",
  text: "Before we calculate anything: if you drop both balls at the same moment, what do you expect to happen?",
};

export default function SessionView() {
  const session = useSession();
  const { policy, events, addEvent } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([OPENING]);
  const [thinking, setThinking] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [steps, setSteps] = useState<ReasoningStep[]>(INITIAL_STEPS);
  const [vizOn, setVizOn] = useState(false);
  const [buggy, setBuggy] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineEvent[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [corrected, setCorrected] = useState(false);
  const turn = useRef(0);

  // countdown
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    setSecondsLeft(policy.timeLimitMin ? policy.timeLimitMin * 60 : null);
  }, [policy.timeLimitMin]);
  useEffect(() => {
    if (secondsLeft === null) return;
    const id = setInterval(() => setSecondsLeft((s) => (s === null ? s : Math.max(0, s - 1))), 1000);
    return () => clearInterval(id);
  }, [secondsLeft === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = { ...STUDENT_HISTORY };
    for (const e of events) if (e.student === STUDENT_NAME) c[e.misconception] = (c[e.misconception] ?? 0) + 1;
    return c as Record<MisconceptionId, number>;
  }, [events]);

  const push = (m: Omit<ChatMessage, "id">) => setMessages((ms) => [...ms, { ...m, id: uid() }]);

  const startViz = useCallback(async () => {
    setVizOn(true);
    setPipeline([]);
    setReviewing(true);
    await runVizPipeline(
      (e) =>
        setPipeline((list) => {
          const last = list[list.length - 1];
          // replace the "running" row for the same step with its result
          if (last && last.status === "running" && last.stage === e.stage) return [...list.slice(0, -1), e];
          return [...list, e];
        }),
      setBuggy,
    );
    setReviewing(false);
  }, []);

  const handleSend = async (text: string, via: "voice" | "text", seconds?: number) => {
    push({ role: "student", text, via, durationSec: seconds });
    setThinking(true);
    const reply = await getTutorReply(text, policy, ++turn.current);
    setThinking(false);

    if (reply.flag) push({ role: "system", text: reply.flag.label, flag: reply.flag });
    push({ role: "tutor", text: reply.text });

    if (reply.misconception) {
      addEvent({ misconception: reply.misconception, problem: PROBLEM.index, student: STUDENT_NAME });
    }
    if (reply.triggerViz) void startViz();

    if (reply.advanceStep === "broke") {
      setSteps((t) => [
        t[0],
        { label: "Predicted heavier falls faster", status: "broke", note: "Broke here" },
        { ...t[2], status: "current" },
        t[3],
      ]);
    } else if (reply.advanceStep === "corrected") {
      setCorrected(true);
      setSteps((t) => [
        t[0],
        t[1].status === "broke" ? { ...t[1], note: "Broke here, then self-corrected" } : { ...t[1], status: "done" },
        { ...t[2], status: "done" },
        { ...t[3], status: "current" },
      ]);
    } else if (reply.advanceStep === "solved") {
      setCorrected(true);
      setSteps((t) => t.map((s) => (s.status === "broke" ? s : { ...s, status: "done" })));
    }
  };

  const handleHint = () => {
    if (hintsUsed >= policy.hintLimit) return;
    push({ role: "system", text: `Hint ${hintsUsed + 1} of ${policy.hintLimit} used`, flag: { kind: "guardrail", label: "hint" } });
    push({ role: "tutor", text: HINTS[Math.min(hintsUsed, HINTS.length - 1)] });
    setHintsUsed((h) => h + 1);
  };

  const mmss = secondsLeft === null ? null : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const passes = pipeline.filter((p) => p.stage === "vision" && p.status !== "running").length;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-4 px-6 py-3.5">
          <Logo />
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{PROBLEM.course}</span>
            <span aria-hidden="true">/</span>
            <span>{PROBLEM.set}</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-ink">
              Problem {PROBLEM.index} of {PROBLEM.total}
            </span>
          </nav>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">{policy.hintLimit} hints max</span>
            {policy.voiceRequired && <span className="chip">Voice required</span>}
            <span className="chip">{policy.revealAnswers ? "Answers allowed" : "Answers hidden"}</span>
            {mmss && <span className="rounded-full bg-ink px-2.5 py-1 font-mono text-[13px] text-white">{mmss} left</span>}
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

      <main className="mx-auto flex max-w-[1360px] flex-wrap items-start gap-5 p-6">
        <section aria-label="Problem and progress" className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
          <ProblemCard problem={PROBLEM} />
          <ReasoningPath steps={steps} />
          <MisconceptionTracker counts={counts} />
        </section>

        <Interview
          messages={messages}
          thinking={thinking}
          hintsUsed={hintsUsed}
          hintLimit={policy.hintLimit}
          voiceRequired={policy.voiceRequired}
          onSend={handleSend}
          onHint={handleHint}
        />

        <section aria-label="Visualization" className="flex min-w-0 flex-[2_1_420px] flex-col gap-4">
          {vizOn ? (
            <FreeFallViz buggy={buggy} reviewing={reviewing} reviewed={!reviewing && passes > 0} passes={passes} />
          ) : (
            <div className="card flex min-h-[300px] flex-col items-center justify-center gap-2 p-8 text-center">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <rect x="4" y="8" width="32" height="24" rx="4" stroke="#C9CCC6" strokeWidth="2" />
                <path d="M10 26l7-8 5 5 4-4 4 7" stroke="#0B7A62" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="font-semibold">Visuals appear when words aren’t enough</p>
              <p className="max-w-[300px] text-sm text-muted">
                Try saying: <span className="font-mono">“the heavier ball hits the ground first”</span>
              </p>
              {policy.tools.visualizations && (
                <button className="btn mt-2 h-10" onClick={startViz}>
                  Show me a visual
                </button>
              )}
            </div>
          )}
          <ReviewerLoop events={pipeline} />
          {corrected && policy.tools.webExamples && <ExampleCard />}
          <p className="sr-only">{MISCONCEPTIONS.length} misconceptions tracked</p>
        </section>
      </main>
    </div>
  );
}
