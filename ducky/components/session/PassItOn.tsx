"use client";

import { useState } from "react";
import { sendTip } from "@/lib/api";
import { clock, useRecorder } from "@/lib/useRecorder";

const MAX = 45;

/**
 * After a student works something out, they can leave 45 seconds on what made it click. Muse
 * transcribes it, maps it to the step, and checks it doesn't give the answer away; the teacher
 * approves it, and the next classmate stuck on that step hears it.
 */
export default function PassItOn({ sessionId }: { sessionId: string }) {
  const rec = useRecorder(MAX);
  const [state, setState] = useState<{ status: "idle" | "sending" | "sent" | "error"; message?: string }>({ status: "idle" });

  const record = async () => {
    const wav = await rec.start();
    if (!wav) return;
    setState({ status: "sending" });
    try {
      const r = await sendTip(sessionId, wav);
      setState({ status: "sent", message: r.summary });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Couldn't send that." });
    }
  };

  return (
    <div className="card p-5">
      <p className="font-semibold">Pass it on</p>
      {state.status === "sent" ? (
        <>
          <p className="mt-1 text-sm text-muted">Thanks. Your teacher will check it, then the next classmate stuck here hears it.</p>
          {state.message && <p className="mt-2 text-[13px] text-sub">Ducky heard: “{state.message}”</p>}
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">You just got past this. Say what made it click, in 45 seconds or less. Don’t say the answer.</p>
          {rec.recording ? (
            <div className="mt-3 flex items-center gap-3">
              <button type="button" className="btn-primary h-9 px-3 text-sm" onClick={rec.stop}>
                Stop and send
              </button>
              <span className="h-2 w-16 overflow-hidden rounded-full bg-line" aria-hidden>
                <span className="block h-full bg-accent" style={{ width: `${Math.round(rec.level * 100)}%` }} />
              </span>
              <span className="font-mono text-xs text-muted">
                {clock(rec.seconds)} / {clock(MAX)}
              </span>
            </div>
          ) : (
            <button type="button" className="btn mt-3 h-9 px-3 text-sm" onClick={() => void record()} disabled={state.status === "sending"}>
              {state.status === "sending" ? "Ducky is listening back…" : "Record a tip"}
            </button>
          )}
          {(rec.error || state.status === "error") && <p className="mt-2 text-sm text-warn">{rec.error ?? state.message}</p>}
        </>
      )}
    </div>
  );
}
