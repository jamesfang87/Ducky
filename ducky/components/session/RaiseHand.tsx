"use client";

import { useState } from "react";
import { raiseHand, setPeerOptIn } from "@/lib/api";

/** Escalation to a human: sends the teacher a packet so they can step in without asking "what's wrong?". */
export default function RaiseHand({ sessionId }: { sessionId: string }) {
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [peer, setPeer] = useState(false);

  const send = async () => {
    setState("sending");
    try {
      await raiseHand(sessionId, note.trim());
      setState("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach your teacher.");
      setState("error");
    }
  };

  const togglePeer = async (on: boolean) => {
    setPeer(on);
    try {
      await setPeerOptIn(sessionId, on);
    } catch {
      setPeer(!on);
    }
  };

  return (
    <div className="card p-5">
      <p className="font-semibold">Still stuck?</p>
      {state === "sent" ? (
        <p className="mt-1 text-sm text-muted">
          Your teacher has your place in the problem and what you've tried. Keep talking it through with Ducky while you wait.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">Raise your hand. Your teacher sees where you are, what's tripping you up, and your last few turns.</p>
          <label className="mt-3 block text-sm">
            <span className="sr-only">What do you want your teacher to know? (optional)</span>
            <input
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything to add? (optional)"
              className="h-10 w-full rounded-[10px] border border-edge px-3 text-sm"
            />
          </label>
          <button type="button" className="btn mt-3 h-9 px-3 text-sm" onClick={() => void send()} disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Raise my hand"}
          </button>
          {state === "error" && <p className="mt-2 text-sm text-warn">{error}</p>}
        </>
      )}
      <label className="mt-3 flex items-start gap-2 text-[13px] text-muted">
        <input type="checkbox" checked={peer} onChange={(e) => void togglePeer(e.target.checked)} className="mt-0.5" />
        <span>Teachers can suggest me as a helper when a classmate is stuck on something I've worked through. Only my first name is shown.</span>
      </label>
    </div>
  );
}
