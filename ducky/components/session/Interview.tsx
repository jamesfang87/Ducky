"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { useSpeech } from "@/lib/useSpeech";
import { useDuckVoice } from "@/lib/useDuckVoice";
import { Check, Mic, Pencil, Send, Shield, Speaker, Stop, Warn } from "@/components/ui/icons";
import { usePersistedState } from "@/lib/usePersistedState";
import DuckAvatar, { type DuckState } from "./DuckAvatar";
import ResizeHandle from "./ResizeHandle";
import SketchPad from "./SketchPad";

interface Props {
  messages: ChatMessage[];
  thinking: boolean;
  /** Ducky's turn is still streaming; don't reopen the mic yet. */
  responding: boolean;
  /** Changes when the student clears this question; stops voice and hands-free. */
  resetToken: number;
  hintsUsed: number;
  hintLimit: number;
  voiceRequired: boolean;
  /** The student explained their full reasoning; no more questions or input. */
  finished: boolean;
  /** The student's last step was wrong (a misconception or an incorrect step); Ducky looks sad. */
  wrong?: boolean;
  onSend: (text: string, via: "voice" | "text", seconds?: number) => void;
  onHint: () => void;
}

export default function Interview({ messages, thinking, responding, resetToken, hintsUsed, hintLimit, voiceRequired, finished, wrong = false, onSend, onHint }: Props) {
  const [draft, setDraft] = useState("");
  const [sketching, setSketching] = useState(false);
  const [handsFree, setHandsFree] = usePersistedState("ducky:handsFree", true);
  // Hands-free only starts after the student has used the mic once, so the page
  // never opens the microphone on load.
  const engaged = useRef(false);
  const lastInputVia = useRef<"voice" | "text" | null>(null);
  const speech = useSpeech((text, secs) => {
    engaged.current = true;
    lastInputVia.current = "voice";
    onSend(text, "voice", secs);
  });
  const voice = useDuckVoice(messages);
  const duckState: DuckState = voice.speaking
    ? "speaking"
    : thinking || speech.transcribing
      ? "thinking"
      : speech.listening
        ? "listening"
        : "idle";
  const scroller = useRef<HTMLDivElement>(null);
  // Height of the message list in px; null keeps the default size.
  const [chatHeight, setChatHeight] = usePersistedState<number | null>("ducky:chatHeight", null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  // Clearing the question stops Ducky, drops the mic, and leaves hands-free off
  // until the student chooses to talk again.
  const resetSeen = useRef(resetToken);
  useEffect(() => {
    if (resetSeen.current === resetToken) return;
    resetSeen.current = resetToken;
    voice.stop();
    if (speech.listening) speech.cancel();
    engaged.current = false;
    lastInputVia.current = null;
  }, [resetToken]);

  // After Ducky finishes a spoken reply, reopen the mic so the student can just
  // keep talking. A pause then sends the turn automatically. Waiting for
  // `responding` to clear avoids opening the mic during a streaming pause.
  useEffect(() => {
    if (responding || voice.speaking || thinking || finished) return;
    if (!handsFree || !engaged.current || lastInputVia.current !== "voice") return;
    if (speech.listening || speech.transcribing || speech.error) return;
    const t = setTimeout(() => {
      if (responding || voice.speaking || thinking || speech.listening || speech.transcribing) return;
      void speech.start({ autoStop: true });
    }, 500);
    return () => clearTimeout(t);
  }, [responding, voice.speaking, thinking, finished, handsFree, speech.listening, speech.transcribing, speech.error, speech.start]);

  // Any student input takes the turn back: Ducky stops talking immediately.
  const takeOver = (via: "voice" | "text") => {
    engaged.current = true;
    lastInputVia.current = via;
    const last = messages[messages.length - 1];
    // If Ducky hasn't said anything yet this turn, silence the reply that is coming.
    voice.stop({ suppressNext: responding && last?.role === "student" });
    if (via === "text" && speech.listening) speech.cancel();
  };

  // Voice required, but fall back to typing when the browser has no speech recognition.
  const typingLocked = voiceRequired && speech.supported;
  const hintsLeft = Math.max(0, hintLimit - hintsUsed);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || thinking) return;
    takeOver("text");
    onSend(draft.trim(), "text");
    setDraft("");
  };

  // Grow the text box with its content, up to about five lines.
  const typed = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = typed.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  return (
    <section aria-label="Interview" className="card flex min-w-0 flex-[2_1_460px] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        <h2 className="h2">Talk it through</h2>
        <div className="flex-1" />
        {speech.supported && (
          <button
            type="button"
            onClick={() => setHandsFree((h) => !h)}
            aria-pressed={handsFree}
            title="Keep listening after Ducky finishes speaking"
            className={`chip transition hover:border-accent ${
              handsFree ? "border-accent/30 bg-accent-tint text-accent-dark" : "text-muted"
            }`}
          >
            Hands-free {handsFree ? "on" : "off"}
          </button>
        )}
        {voice.supported && (
          <button
            type="button"
            onClick={() => voice.setMuted((m) => !m)}
            aria-pressed={!voice.muted}
            aria-label={voice.muted ? "Unmute Ducky's voice" : "Mute Ducky's voice"}
            title={voice.muted ? "Ducky is muted" : "Ducky speaks aloud"}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-ground ${
              voice.muted ? "text-muted" : voice.speaking ? "text-accent" : "text-sub"
            }`}
          >
            <Speaker off={voice.muted} className={voice.speaking ? "animate-pulse" : undefined} />
          </button>
        )}
        <span className="text-[13px] text-sub">
          Hints <span className="font-mono font-medium">{hintsUsed} / {hintLimit}</span>
        </span>
      </div>

      <div className="flex items-center gap-4 border-b border-line bg-surface px-5 py-3">
        <DuckAvatar state={duckState} mood={wrong ? "sad" : "neutral"} wordTick={voice.wordTick} level={voice.level} />
        <div className="min-w-0">
          <p className="font-display text-lg font-bold">Ducky</p>
          <p className="text-[13px] text-sub" aria-live="polite">
            {duckState === "speaking"
              ? "Talking… tap the mic or type to interrupt."
              : duckState === "thinking"
                ? "Thinking it over…"
                : duckState === "listening"
                  ? handsFree
                    ? "Listening… pause when you're done."
                    : "Listening to you…"
                  : finished
                    ? "Nice work. That's the whole explanation."
                    : wrong
                      ? "Hmm, not quite. Let's look at that step again."
                      : "Explain your reasoning. I'll keep asking why."}
          </p>
        </div>
      </div>

      <div
        ref={scroller}
        style={chatHeight ? { height: chatHeight } : undefined}
        className={`flex flex-col gap-4 overflow-y-auto p-5 ${chatHeight ? "" : "max-h-[560px] min-h-[360px] flex-1"}`}
        aria-live="polite"
      >
        {messages.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
        {thinking && (
          <div className="max-w-[86%]">
            <p className="mb-1 text-xs font-semibold text-muted">DUCKY</p>
            <div className="flex gap-1 rounded-[4px_14px_14px_14px] bg-ground px-3.5 py-3.5" aria-label="Ducky is thinking">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <ResizeHandle
        orientation="horizontal"
        label="Resize chat height"
        className="-my-2.5 w-full"
        measure={() => scroller.current?.getBoundingClientRect().height ?? 360}
        min={200}
        max={() => Math.max(200, window.innerHeight - 160)}
        onResize={setChatHeight}
        onReset={() => setChatHeight(null)}
      />

      {finished ? (
        <div className="flex items-center gap-2 border-t border-line px-5 py-4 text-sm" role="status">
          <Check /> <span className="font-semibold">You explained your full reasoning.</span>
          <span className="text-muted">This problem is complete; Ducky has no more questions.</span>
        </div>
      ) : (
      <div className="flex flex-col gap-3 border-t border-line px-5 pb-5 pt-4">
        {sketching && (
          <SketchPad
            onCancel={() => setSketching(false)}
            onSend={() => {
              setSketching(false);
              onSend("[Sketch] Two arrows: mg pointing down on each ball, the bigger arrow on the 10 kg ball.", "text");
            }}
          />
        )}

        <div className="flex flex-wrap items-center gap-3.5">
          <button
            onClick={() => {
              if (speech.listening) return speech.stop();
              takeOver("voice"); // Ducky goes quiet the moment the student starts
              return speech.start({ autoStop: handsFree });
            }}
            disabled={!speech.supported || thinking || speech.transcribing}
            aria-label={speech.listening ? "Send my answer" : voice.speaking ? "Interrupt Ducky and talk" : "Tap to talk"}
            title={speech.listening ? "Pause to send" : voice.speaking ? "Interrupt Ducky" : "Tap to talk"}
            className={`flex h-16 w-16 flex-none items-center justify-center rounded-full text-onaccent transition disabled:opacity-40 ${
              speech.listening ? "bg-warn text-ground shadow-[0_0_0_8px_rgb(var(--warn-tint))]" : "bg-accent shadow-[0_0_0_8px_rgb(var(--accent-tint))] hover:bg-accent-dark"
            }`}
          >
            {speech.listening ? <Stop /> : <Mic />}
          </button>
          <div className="min-w-0 flex-[1_1_200px]">
            <p className="font-semibold">
              {!speech.supported
                ? "Voice isn’t supported in this browser. Type below."
                : speech.listening
                  ? handsFree
                    ? "Listening… pause when you're done"
                    : "Listening… tap to send"
                  : speech.transcribing
                    ? "Transcribing…"
                    : voice.speaking
                      ? "Ducky is talking. Tap the mic or type to interrupt."
                      : typingLocked
                        ? "Tap to talk through your reasoning"
                        : "Tap to talk, or type below"}
            </p>
            {speech.listening && (
              <div aria-hidden="true" className="mt-0.5 flex h-7 items-center gap-[3px]">
                {Array.from({ length: 16 }, (_, i) => (
                  <span key={i} className="h-6 w-[3px] origin-center animate-bar rounded-sm bg-accent" style={{ animationDelay: `${(i * 97) % 900}ms` }} />
                ))}
              </div>
            )}
            {speech.interim && <p className="mt-0.5 font-mono text-[13px] text-muted">“{speech.interim}”</p>}
            {speech.error && <p className="mt-0.5 text-[13px] text-warn">{speech.error}</p>}
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <label htmlFor="typed" className="sr-only">
            Type your reasoning
          </label>
          <textarea
            ref={typed}
            id="typed"
            rows={1}
            value={draft}
            onFocus={() => {
              if (speech.listening || voice.speaking) takeOver("text");
            }}
            onChange={(e) => {
              takeOver("text");
              setDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter adds a line. Skip while an IME is composing.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={typingLocked}
            placeholder={typingLocked ? "Voice required by your teacher" : "Type your reasoning…"}
            aria-describedby={typingLocked ? undefined : "typed-help"}
            className="min-h-11 min-w-0 flex-[1_1_220px] resize-none rounded-[10px] border border-edge bg-surface px-3.5 py-2.5 leading-snug text-ink placeholder:text-muted disabled:bg-ground"
          />
          {!typingLocked && (
            <button type="submit" className="btn-primary" disabled={!draft.trim() || thinking} aria-label="Send">
              <Send />
            </button>
          )}
          <button type="button" className="btn" onClick={() => setSketching((s) => !s)}>
            <Pencil /> Sketch
          </button>
          <button type="button" className="btn" onClick={onHint} disabled={hintsLeft === 0 || thinking}>
            {hintsLeft === 0 ? "No hints left" : `Use hint (${hintsLeft} left)`}
          </button>
        </form>
        {!typingLocked && (
          <p id="typed-help" className="-mt-1 text-[12px] text-muted">
            Enter to send · Shift+Enter for a new line
          </p>
        )}
      </div>
      )}
    </section>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === "system") {
    const tone =
      m.flag?.kind === "correct"
        ? "bg-accent-tint text-accent-dark"
        : m.flag?.kind === "guardrail"
          ? "bg-ground text-sub border border-line"
          : "bg-warn-tint text-warn-dark";
    return (
      <div className={`flex animate-fadein items-center gap-2 self-center rounded-full px-3 py-1.5 text-[13px] font-medium ${tone}`}>
        {m.flag?.kind === "correct" ? <Check /> : m.flag?.kind === "guardrail" ? <Shield /> : <Warn />}
        {m.text}
      </div>
    );
  }
  const student = m.role === "student";
  return (
    <div className={`max-w-[86%] animate-fadein ${student ? "self-end" : ""}`}>
      <p className={`mb-1 text-xs font-semibold text-muted ${student ? "text-right" : ""}`}>
        {student ? `YOU · ${m.via === "voice" ? `voice 0:${String(m.durationSec ?? 0).padStart(2, "0")}` : "text"}` : "DUCKY"}
      </p>
      <div
        className={
          student
            ? "whitespace-pre-wrap rounded-[14px_4px_14px_14px] bg-ink px-3.5 py-3 text-ground"
            : "whitespace-pre-wrap rounded-[4px_14px_14px_14px] bg-ground px-3.5 py-3"
        }
      >
        {m.text}
      </div>
    </div>
  );
}
