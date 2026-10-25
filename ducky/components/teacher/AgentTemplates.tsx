"use client";

import { useState } from "react";
import { Check, Plus, Spinner } from "@/components/ui/icons";
import { DEFAULT_POLICY } from "@/lib/mock";
import type { AgentTemplate, TeacherSetOption } from "@/lib/insights";
import type { Policy } from "@/lib/types";
import { PolicyFields } from "./PolicyPanel";
import { sendJson } from "./dialog";

/** Starting points offered in "New agent". */
const STARTERS: { name: string; description: string; policy: Policy }[] = [
  {
    name: "Socratic coach",
    description: "Asks, never tells. A couple of hints, no answer reveal.",
    policy: { ...DEFAULT_POLICY, hintLimit: 2, hintPenalty: 10, revealAfterHints: false, tone: "Socratic" },
  },
  {
    name: "Encouraging helper",
    description: "More hints, no penalty, answer available once hints run out.",
    policy: { ...DEFAULT_POLICY, hintLimit: 4, hintPenalty: 0, revealAfterHints: true, tone: "Encouraging" },
  },
  {
    name: "Exam prep",
    description: "Spoken answers, no hints, no tools: practice under test conditions.",
    policy: {
      ...DEFAULT_POLICY,
      hintLimit: 0,
      hintPenalty: 0,
      revealAfterHints: false,
      voiceRequired: true,
      tone: "Exam-style",
      tools: { visualizations: false, webExamples: false, calculator: false },
    },
  },
];

type Draft = Pick<AgentTemplate, "name" | "description" | "policy">;

function summary(p: Policy): string {
  const tools = Object.values(p.tools).filter(Boolean).length;
  return [
    p.tone,
    `${p.hintLimit} ${p.hintLimit === 1 ? "hint" : "hints"}`,
    p.hintPenalty ? `−${p.hintPenalty}/hint` : "no penalty",
    p.voiceRequired ? "voice" : null,
    `${tools} ${tools === 1 ? "tool" : "tools"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function AgentTemplates({ initialTemplates, sets }: { initialTemplates: AgentTemplate[]; sets: TeacherSetOption[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  /** Template id being edited, "new" for an unsaved one, null for none. */
  const [selected, setSelected] = useState<string | null>(initialTemplates[0]?.id ?? null);
  const [draft, setDraft] = useState<Draft | null>(initialTemplates[0] ?? null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [applyTo, setApplyTo] = useState(sets[0]?.id ?? "");

  const open = (id: string | null, d: Draft | null) => {
    if (dirty && !window.confirm("Discard unsaved changes to this agent?")) return;
    setSelected(id);
    setDraft(d);
    setDirty(false);
    setError(null);
    setNotice(null);
  };

  const edit = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
    setNotice(null);
  };

  const run = async (kind: "save" | "delete" | "apply", fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run("save", async () => {
      if (!draft) return;
      if (selected === "new") {
        const { id, updatedAt } = await sendJson<{ id: string; updatedAt: string }>("/api/teacher/templates", "POST", draft);
        setTemplates((ts) => [...ts, { id, updatedAt, ...draft }]);
        setSelected(id);
      } else if (selected) {
        const { updatedAt } = await sendJson<{ updatedAt: string }>(`/api/teacher/templates/${selected}`, "PATCH", draft);
        setTemplates((ts) => ts.map((t) => (t.id === selected ? { ...t, ...draft, updatedAt } : t)));
      }
      setDirty(false);
      setNotice("Saved.");
    });

  const remove = () =>
    run("delete", async () => {
      if (!selected || selected === "new" || !window.confirm(`Delete “${draft?.name}”? Problem sets that used it keep their settings.`)) return;
      await sendJson(`/api/teacher/templates/${selected}`, "DELETE");
      const rest = templates.filter((t) => t.id !== selected);
      setTemplates(rest);
      setSelected(rest[0]?.id ?? null);
      setDraft(rest[0] ?? null);
      setDirty(false);
    });

  const apply = () =>
    run("apply", async () => {
      const set = sets.find((s) => s.id === applyTo);
      if (!draft || !set) return;
      if (!window.confirm(`Replace the tutor settings on ${set.className} · ${set.title} with “${draft.name}”? Students get them within a few seconds.`)) return;
      // The route fills missing fields with defaults, so always send the whole policy.
      await sendJson(`/api/teacher/assignments/${set.id}`, "PATCH", { policy: draft.policy });
      setNotice(`Applied to ${set.className} · ${set.title}.`);
    });

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-[1_1_300px]">
          <p className="text-sm text-muted">Reusable tutor settings</p>
          <h1 className="mt-0.5 font-display text-[30px] font-bold tracking-tight">Tutor agents</h1>
          <p className="mt-1 text-sub">Build an agent once, then apply it to any problem set. You can still fine-tune a set on its class page.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => open("new", { ...STARTERS[0], name: "New agent", description: "" })}>
          <Plus /> New agent
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Your agents" className="flex min-w-0 flex-[1_1_260px] flex-col gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => t.id !== selected && open(t.id, t)}
              aria-current={t.id === selected ? "true" : undefined}
              className={`card p-4 text-left transition hover:border-accent ${t.id === selected ? "border-accent ring-1 ring-accent" : ""}`}
            >
              <span className="block font-display font-semibold">{t.name}</span>
              {t.description && <span className="mt-0.5 block text-[13px] text-sub">{t.description}</span>}
              <span className="mt-2 block text-[12.5px] text-muted">{summary(t.policy)}</span>
            </button>
          ))}
          {selected === "new" && (
            <div className="card border-dashed border-accent p-4">
              <span className="block font-display font-semibold">{draft?.name || "New agent"}</span>
              <span className="text-[12.5px] text-muted">Not saved yet</span>
            </div>
          )}

          <div className="mt-2 rounded-[14px] border border-dashed border-edge p-4">
            <p className="eyebrow">Start from</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {STARTERS.map((s) => (
                <button key={s.name} type="button" onClick={() => open("new", s)} className="rounded-[10px] px-2.5 py-2 text-left transition hover:bg-surface">
                  <span className="block text-sm font-semibold">{s.name}</span>
                  <span className="text-[12.5px] text-muted">{s.description}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {draft ? (
          <section aria-label="Agent settings" className="card min-w-0 flex-[2_1_380px] p-5">
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">Name</span>
                <input value={draft.name} maxLength={80} onChange={(e) => edit({ name: e.target.value })} className="h-10 rounded-[10px] border border-edge px-3" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">Description</span>
                <input
                  value={draft.description}
                  maxLength={300}
                  placeholder="When to use this agent"
                  onChange={(e) => edit({ description: e.target.value })}
                  className="h-10 rounded-[10px] border border-edge px-3 placeholder:text-muted"
                />
              </label>
            </div>

            <div className="my-5 border-t border-line" />
            <PolicyFields policy={draft.policy} onChange={(p) => edit({ policy: { ...draft.policy, ...p } })} idPrefix="agent" />

            {error && (
              <p role="alert" className="mt-4 rounded-[10px] border border-warn-soft bg-warn-tint px-3 py-2 text-sm text-warn-dark">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="mt-4 flex items-center gap-2 rounded-[10px] bg-accent-tint px-3 py-2 text-sm text-accent-dark">
                <Check /> {notice}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={save} disabled={!!busy || !draft.name.trim() || (!dirty && selected !== "new")}>
                {busy === "save" ? <Spinner /> : null} {selected === "new" ? "Save agent" : "Save changes"}
              </button>
              {selected !== "new" && (
                <button type="button" className="btn" onClick={remove} disabled={!!busy}>
                  {busy === "delete" ? <Spinner /> : null} Delete
                </button>
              )}
              {selected === "new" && (
                <button type="button" className="btn" onClick={() => open(templates[0]?.id ?? null, templates[0] ?? null)} disabled={!!busy}>
                  Cancel
                </button>
              )}
            </div>

            <div className="mt-6 rounded-[12px] bg-ground p-4">
              <p className="text-sm font-semibold">Apply to a problem set</p>
              {sets.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <label htmlFor="apply-set" className="sr-only">
                    Problem set
                  </label>
                  <select
                    id="apply-set"
                    value={applyTo}
                    onChange={(e) => setApplyTo(e.target.value)}
                    className="h-10 min-w-0 flex-[1_1_220px] rounded-[10px] border border-edge bg-surface px-3 text-sm"
                  >
                    {sets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.className} · {s.title}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn-dark" onClick={apply} disabled={!!busy || dirty}>
                    {busy === "apply" ? <Spinner /> : null} Apply
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-[13px] text-muted">Upload a problem set to a class first, then apply this agent to it.</p>
              )}
              {dirty && sets.length > 0 && <p className="mt-2 text-[12.5px] text-muted">Save your changes before applying.</p>}
            </div>
          </section>
        ) : (
          <section className="card flex min-w-0 flex-[2_1_380px] flex-col items-start gap-2 p-6">
            <h2 className="font-display text-lg font-semibold">No agents yet</h2>
            <p className="text-sm text-sub">Create one from scratch or start from a preset on the left.</p>
          </section>
        )}
      </div>
    </>
  );
}
