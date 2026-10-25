"use client";

import { Shield } from "@/components/ui/icons";
import { useStore } from "@/lib/store";
import type { Policy, Tone } from "@/lib/types";

const TONES: Tone[] = ["Socratic", "Encouraging", "Exam-style"];
const MAX_HINTS = 10;
const MAX_HINT_PENALTY = 50;
const PENALTY_STEP = 5;

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3">
      <span>
        {label}
        {hint && <span className="block text-[12.5px] text-muted">{hint}</span>}
      </span>
      <span className="relative inline-flex flex-none">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-edge transition peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/**
 * The assignment settings form, shared by the demo dashboard and each uploaded problem set.
 * `idPrefix` keeps input ids unique when several forms are on one page.
 */
export function PolicyFields({ policy, onChange, idPrefix = "policy" }: { policy: Policy; onChange: (p: Partial<Policy>) => void; idPrefix?: string }) {
  const setTool = (k: keyof Policy["tools"]) => onChange({ tools: { ...policy.tools, [k]: !policy.tools[k] } });
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <span id={id("hint-label")}>
          Hints per question
          <span className="block text-[12.5px] text-muted">0 means no hints</span>
        </span>
        <span className="flex flex-none items-center overflow-hidden rounded-lg border border-edge" role="group" aria-labelledby={id("hint-label")}>
          <button type="button" aria-label="Fewer hints" className="h-10 w-10 bg-ground hover:bg-line disabled:opacity-40" disabled={policy.hintLimit <= 0} onClick={() => onChange({ hintLimit: Math.max(0, policy.hintLimit - 1) })}>
            −
          </button>
          <span className="w-10 text-center font-mono font-medium" aria-live="polite">
            {policy.hintLimit}
          </span>
          <button type="button" aria-label="More hints" className="h-10 w-10 bg-ground hover:bg-line disabled:opacity-40" disabled={policy.hintLimit >= MAX_HINTS} onClick={() => onChange({ hintLimit: Math.min(MAX_HINTS, policy.hintLimit + 1) })}>
            +
          </button>
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span id={id("penalty-label")}>
          Hint penalty
          <span className="block text-[12.5px] text-muted" aria-live="polite">
            {policy.hintPenalty > 0 ? `−${policy.hintPenalty} pts per hint` : "No penalty"}
          </span>
        </span>
        <span className="flex flex-none items-center overflow-hidden rounded-lg border border-edge" role="group" aria-labelledby={id("penalty-label")}>
          <button type="button" aria-label="Smaller penalty" className="h-10 w-10 bg-ground hover:bg-line disabled:opacity-40" disabled={policy.hintPenalty <= 0} onClick={() => onChange({ hintPenalty: Math.max(0, policy.hintPenalty - PENALTY_STEP) })}>
            −
          </button>
          <span className="w-10 text-center font-mono font-medium">{policy.hintPenalty}</span>
          <button type="button" aria-label="Bigger penalty" className="h-10 w-10 bg-ground hover:bg-line disabled:opacity-40" disabled={policy.hintPenalty >= MAX_HINT_PENALTY} onClick={() => onChange({ hintPenalty: Math.min(MAX_HINT_PENALTY, policy.hintPenalty + PENALTY_STEP) })}>
            +
          </button>
        </span>
      </div>

      <Toggle
        id={id("reveal")}
        label="Show answer after hints run out"
        hint="Students can view the answer for no credit"
        checked={policy.revealAfterHints}
        onChange={(v) => onChange({ revealAfterHints: v })}
      />
      <Toggle id={id("voice")} label="Voice required" hint="Students must explain out loud" checked={policy.voiceRequired} onChange={(v) => onChange({ voiceRequired: v })} />
      <Toggle
        id={id("stay")}
        label="Stay on assignment"
        hint="Ducky steers off-topic chat back to the problem"
        checked={policy.guardrails.stayOnAssignment}
        onChange={(v) => onChange({ guardrails: { ...policy.guardrails, stayOnAssignment: v } })}
      />

      <div>
        <p className="mb-2">Tone</p>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={policy.tone === t}
              onClick={() => onChange({ tone: t })}
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
              type="button"
              aria-pressed={policy.tools[k]}
              onClick={() => setTool(k)}
              className={`rounded-lg px-2.5 py-1.5 transition ${policy.tools[k] ? "bg-accent-tint text-accent-dark" : "bg-ground text-muted line-through"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Not a setting: the server always applies the jailbreak shield. */}
      <p className="flex items-center gap-2 rounded-[10px] bg-ground px-3 py-2 text-[13px] text-sub">
        <Shield className="flex-none text-accent" /> Jailbreak shield is always on for every assignment.
      </p>
    </div>
  );
}

export default function PolicyPanel() {
  const { policy, setPolicy } = useStore();

  return (
    <section aria-label="Tutor agent policy" className="card min-w-0 flex-[2_1_320px] p-5">
      <h2 className="font-display text-lg font-semibold">Tutor agent policy</h2>
      <p className="mb-4 text-[13px] text-muted">Applies live to every student on this assignment. No code.</p>
      <PolicyFields policy={policy} onChange={setPolicy} />
    </section>
  );
}
