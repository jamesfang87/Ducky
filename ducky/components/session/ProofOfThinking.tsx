"use client";

import { useEffect, useState } from "react";
import type { ChatMessage, ReasoningStep } from "@/lib/types";
import { buildProof, fingerprint } from "@/lib/proof";

interface Props {
  student: string;
  course: string;
  set: string;
  problem: string;
  messages: ChatMessage[];
  steps: ReasoningStep[];
  hintsUsed: number;
  hintLimit: number;
  revealed: boolean;
}

/** Side-panel card that opens a printable receipt of how the student reasoned. */
export function ProofOfThinkingCard(props: Props) {
  const [open, setOpen] = useState(false);
  const said = props.messages.filter((m) => m.role === "student").length;
  return (
    <>
      <div className="card p-5">
        <h2 className="h2">Proof of thinking</h2>
        <p className="mt-1 text-sm text-muted">
          A receipt of how you reasoned, in your own words. Share it with your teacher if anyone ever asks whether the work was yours.
        </p>
        <button type="button" disabled={said === 0} onClick={() => setOpen(true)} className="btn mt-3 h-9 px-3 text-sm">
          {said === 0 ? "Explain something first" : "Open my receipt"}
        </button>
      </div>
      {open && <Receipt {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function Receipt({ onClose, ...props }: Props & { onClose: () => void }) {
  // Frozen when opened, so the fingerprint matches what the student saw.
  const [proof] = useState(() => buildProof(props));
  const [hash, setHash] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void fingerprint(proof).then(setHash).catch(() => setHash(""));
  }, [proof]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const short = hash ? `${hash.slice(0, 8)}-${hash.slice(8, 16)}-${hash.slice(16, 24)}-${hash.slice(24, 32)}`.toUpperCase() : "computing…";
  const when = new Date(proof.issuedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const minutes = proof.voiceSeconds >= 60 ? `${Math.floor(proof.voiceSeconds / 60)}m ${proof.voiceSeconds % 60}s` : `${proof.voiceSeconds}s`;

  async function copy() {
    const text = [
      `Proof of thinking: ${proof.student}`,
      `${proof.course} / ${proof.set} / ${proof.problem}`,
      `Issued ${when}`,
      `Spoken answers: ${proof.spoken}, typed: ${proof.typed}, ${proof.words} words`,
      `Steps explained: ${proof.stepsDone} of ${proof.stepsTotal}. Hints: ${proof.hintsUsed} of ${proof.hintLimit}. Answer shown: ${proof.revealed ? "yes" : "no"}`,
      `Misconceptions caught: ${proof.caught.join("; ") || "none"}. Fixed: ${proof.fixed.join("; ") || "none"}`,
      `Fingerprint: ${short}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:static print:bg-transparent print:p-0" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <style>{`@media print { body * { visibility: hidden; } #proof, #proof * { visibility: visible; } #proof { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: none; } .no-print { display: none !important; } }`}</style>
      <article id="proof" role="dialog" aria-label="Proof of thinking" className="my-6 w-full max-w-[680px] rounded-2xl border border-line bg-surface p-8 text-ink shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="eyebrow">Proof of thinking</p>
            <h2 className="mt-1 font-display text-[26px] font-bold leading-tight">{proof.student}</h2>
            <p className="mt-1 text-sm text-sub">
              {proof.course} · {proof.set} · {proof.problem}
            </p>
            <p className="mt-0.5 text-[13px] text-muted">Issued {when}</p>
            <p className="mt-3 inline-block rounded-full border border-line px-3 py-1 font-mono text-[12px] text-sub">Fingerprint {short}</p>
          </div>
        </header>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Spoken answers", String(proof.spoken)],
            ["Typed answers", String(proof.typed)],
            ["Time speaking", minutes],
            ["Words explained", String(proof.words)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-ground px-3 py-2.5">
              <dt className="text-[12px] text-muted">{k}</dt>
              <dd className="font-display text-[22px] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-6">
          <h3 className="h2">Steps explained ({proof.stepsDone} of {proof.stepsTotal})</h3>
          <ul className="mt-2 space-y-1.5 text-[14px]">
            {proof.stepLabels.map((s) => (
              <li key={s.label} className="flex items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${s.done ? "bg-accent" : "border border-edge"}`} />
                <span className={s.done ? "" : "text-muted"}>{s.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="h2">Help used</h3>
            <p className="mt-1 text-[14px] text-sub">
              {proof.hintsUsed} of {proof.hintLimit} hints. Answer {proof.revealed ? "was shown (no credit)" : "was never shown"}.
            </p>
          </div>
          <div>
            <h3 className="h2">Misconceptions</h3>
            <p className="mt-1 text-[14px] text-sub">
              {proof.caught.length === 0 ? "None flagged." : `${proof.caught.length} flagged, ${proof.fixed.length} fixed by the student.`}
            </p>
            {proof.caught.length > 0 && <p className="mt-1 text-[13px] text-muted">{proof.caught.join(" · ")}</p>}
          </div>
        </section>

        <p className="mt-6 rounded-xl bg-ground px-4 py-3 text-[13px] leading-relaxed text-sub">
          This is a record of process, not a verdict. It shows how the student worked through the problem with Ducky: what they said, where
          they got stuck, and what they fixed. The fingerprint is a SHA-256 hash of the full transcript, so any edit to the transcript
          produces a different code, so a teacher can check a printed receipt against the saved transcript.
        </p>

        <div className="no-print mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn h-10 px-4 text-sm" onClick={copy}>
            {copied ? "Copied" : "Copy summary"}
          </button>
          <button type="button" className="btn h-10 px-4 text-sm" onClick={() => window.print()}>
            Print or save as PDF
          </button>
          <button type="button" className="btn-primary h-10 px-4 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </article>
    </div>
  );
}
