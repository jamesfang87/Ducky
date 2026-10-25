"use client";

import { useStore } from "@/lib/store";
import type { Policy, Tone } from "@/lib/types";

const TONES: Tone[] = ["Socratic", "Encouraging", "Exam-style"];

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3">
      {label}
      <span className="relative inline-flex">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-edge transition peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export default function PolicyPanel() {
  const { policy, setPolicy } = useStore();
  const setTool = (k: keyof Policy["tools"]) => setPolicy({ tools: { ...policy.tools, [k]: !policy.tools[k] } });

  return (
    <section aria-label="Tutor agent policy" className="card min-w-0 flex-[2_1_320px] p-5">
      <h2 className="font-display text-lg font-semibold">Tutor agent policy</h2>
      <p className="mb-4 text-[13px] text-muted">Applies live to every student on this assignment. No code.</p>

      <div className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3">
          <span id="hint-label">Hint limit</span>
          <span className="flex items-center overflow-hidden rounded-lg border border-edge" role="group" aria-labelledby="hint-label">
            <button aria-label="Fewer hints" className="h-10 w-10 bg-ground hover:bg-line" onClick={() => setPolicy({ hintLimit: Math.max(0, policy.hintLimit - 1) })}>
              −
            </button>
            <span className="w-10 text-center font-mono font-medium" aria-live="polite">
              {policy.hintLimit}
            </span>
            <button aria-label="More hints" className="h-10 w-10 bg-ground hover:bg-line" onClick={() => setPolicy({ hintLimit: Math.min(5, policy.hintLimit + 1) })}>
              +
            </button>
          </span>
        </div>

        <Toggle id="reveal" label="May reveal answers" checked={policy.revealAnswers} onChange={(v) => setPolicy({ revealAnswers: v })} />
        <Toggle id="voice" label="Voice required" checked={policy.voiceRequired} onChange={(v) => setPolicy({ voiceRequired: v })} />

        <div>
          <p className="mb-2">Tone</p>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((t) => (
              <button
                key={t}
                aria-pressed={policy.tone === t}
                onClick={() => setPolicy({ tone: t })}
                className={`h-9 rounded-full px-3 text-sm transition ${policy.tone === t ? "bg-ink text-ground" : "border border-edge bg-surface hover:bg-ground"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2">Tools</p>
          <div className="flex flex-wrap gap-1.5 text-[13px]">
            {(
              [
                ["visualizations", "Visualizations"],
                ["webExamples", "Web examples (SerpApi)"],
                ["calculator", "Calculator"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                aria-pressed={policy.tools[k]}
                onClick={() => setTool(k)}
                className={`rounded-lg px-2.5 py-1.5 transition ${policy.tools[k] ? "bg-accent-tint text-accent-dark" : "bg-ground text-muted line-through"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Toggle
          id="shield"
          label="Jailbreak shield"
          checked={policy.guardrails.jailbreakShield}
          onChange={(v) => setPolicy({ guardrails: { ...policy.guardrails, jailbreakShield: v } })}
        />
        <Toggle
          id="stay"
          label="Stay on assignment"
          checked={policy.guardrails.stayOnAssignment}
          onChange={(v) => setPolicy({ guardrails: { ...policy.guardrails, stayOnAssignment: v } })}
        />
      </div>
    </section>
  );
}
