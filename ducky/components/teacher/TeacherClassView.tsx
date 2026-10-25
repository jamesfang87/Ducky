"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Check, Plus, Spinner, Warn } from "@/components/ui/icons";
import { formatDay, type TeacherAssignment, type TeacherClassDetail } from "@/lib/classroom";
import { DEFAULT_POLICY } from "@/lib/mock";
import type { Policy } from "@/lib/types";
import { PolicyFields } from "./PolicyPanel";
import { Dialog, sendJson } from "./dialog";
import TeacherShell from "./TeacherShell";

const ACCEPT = ".pdf,.txt,.md,image/png,image/jpeg,image/webp";
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** "2026-10-30" for a date input, from a stored ISO timestamp. */
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export default function TeacherClassView({ detail }: { detail: TeacherClassDetail }) {
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeUpload = useCallback(() => setUploading(false), []);
  const total = detail.assignments.length;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(detail.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the code is on screen anyway */
    }
  };

  return (
    <TeacherShell>
      <div className="pb-16">
        <Link href="/teacher" className="inline-flex items-center gap-1.5 text-sm text-sub no-underline transition hover:text-ink">
          <span aria-hidden="true">←</span> My classes
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{detail.courseNumber ?? "Class"}</p>
            <h1 className="mt-1 font-display text-[32px] font-bold tracking-[-0.02em] md:text-[38px]">{detail.name}</h1>
            <p className="mt-1.5 text-sub">
              {detail.students} {detail.students === 1 ? "student" : "students"} · {total} {total === 1 ? "problem set" : "problem sets"}
            </p>
          </div>
          <div className="card flex items-center gap-4 px-4 py-3">
            <div>
              <p className="eyebrow">Join code</p>
              <p className="mt-0.5 font-mono text-[26px] font-semibold tracking-[0.18em]">{detail.joinCode}</p>
            </div>
            <button type="button" onClick={copyCode} className="btn h-9 px-3 text-sm" aria-live="polite">
              {copied ? (
                <>
                  <Check /> Copied
                </>
              ) : (
                "Copy"
              )}
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-start gap-6">
          <section aria-labelledby="sets-title" className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="sets-title" className="font-display text-[22px] font-semibold">
                  Problem sets
                </h2>
                <p className="mt-0.5 text-sm text-sub">Upload a set, check what Ducky drafted, set the rules, then publish it to students.</p>
              </div>
              <button type="button" onClick={() => setUploading(true)} className="btn-primary">
                <Plus /> Upload problem set
              </button>
            </div>

            {detail.assignments.length ? (
              detail.assignments.map((a, i) => <AssignmentCard key={a.id} assignment={a} number={total - i} defaultOpen={i === 0 && !a.published} />)
            ) : (
              <div className="card flex flex-col items-center gap-3 p-10 text-center">
                <p className="font-display text-lg font-semibold">No problem sets yet</p>
                <p className="max-w-[400px] text-sm text-sub">
                  Upload a PDF, photos of a worksheet, or paste the problems. Ducky splits them up and drafts solutions, hints and likely misconceptions for you to review.
                </p>
                <button type="button" onClick={() => setUploading(true)} className="btn-primary mt-1">
                  Upload problem set
                </button>
              </div>
            )}
          </section>

          <aside aria-labelledby="roster-title" className="card min-w-0 flex-[1_1_260px] p-5">
            <h2 id="roster-title" className="font-display text-lg font-semibold">
              Students
            </h2>
            {detail.roster.length ? (
              <ul className="mt-3 flex flex-col divide-y divide-line">
                {detail.roster.map((s) => (
                  <li key={s.studentId} className="py-2.5">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-[12.5px] text-muted">
                      {s.email ? `${s.email} · ` : ""}joined {formatDay(s.joinedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-sub">
                No one has joined yet. Students sign in, choose <span className="font-semibold">Join a class</span>, and enter{" "}
                <span className="font-mono font-semibold text-ink">{detail.joinCode}</span>.
              </p>
            )}
          </aside>
        </div>
      </div>

      {uploading && <UploadDialog classId={detail.id} onClose={closeUpload} />}
    </TeacherShell>
  );
}

function AssignmentCard({ assignment: a, number, defaultOpen }: { assignment: TeacherAssignment; number: number; defaultOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<"settings" | "problems" | null>(defaultOpen ? "problems" : null);
  const [policy, setPolicy] = useState<Policy>(a.policy);
  const [due, setDue] = useState(toDateInput(a.dueAt));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(policy) !== JSON.stringify(a.policy) || due !== toDateInput(a.dueAt);

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await action();
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const ok = await run("save", () => sendJson(`/api/teacher/assignments/${a.id}`, "PATCH", { policy, dueDate: due || null }));
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };
  const togglePublish = () => run("publish", () => sendJson(`/api/teacher/assignments/${a.id}`, "PATCH", { published: !a.published }));
  const remove = () => {
    if (!window.confirm(`Delete “${a.title}”? Students lose access to it, and this can’t be undone.`)) return;
    void run("delete", () => sendJson(`/api/teacher/assignments/${a.id}`, "DELETE"));
  };
  const toggle = (panel: "settings" | "problems") => setOpen((cur) => (cur === panel ? null : panel));

  const summary = [
    `${a.problems.length} ${a.problems.length === 1 ? "problem" : "problems"}`,
    `${a.policy.hintLimit} ${a.policy.hintLimit === 1 ? "hint" : "hints"} each`,
    a.policy.voiceRequired ? "voice required" : null,
    a.policy.revealAfterHints ? "answer after hints" : "answers hidden",
    a.dueAt ? `due ${formatDay(a.dueAt)}` : null,
  ].filter(Boolean);

  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-12 w-12 flex-none flex-col items-center justify-center rounded-xl border border-line bg-ground" aria-hidden="true">
          <span className="font-mono text-[15px] font-semibold leading-none">{number}</span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">PS</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[17px] font-semibold leading-snug">
              Problem Set {number} · {a.title}
            </h3>
            <span className={`chip ${a.published ? "border-accent/25 bg-accent-tint text-accent-dark" : "border-warn-soft bg-warn-tint text-warn-dark"}`}>
              {a.published ? "Published" : "Draft"}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] text-muted">{summary.join(" · ")}</p>
          {a.sourceFile && <p className="text-[12.5px] text-muted">From {a.sourceFile}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {a.problems[0] && (
            <Link href={`/session/${a.problems[0].id}`} className="btn h-9 px-3 text-sm no-underline">
              Preview
            </Link>
          )}
          <button type="button" onClick={togglePublish} disabled={!!busy} className={a.published ? "btn h-9 px-3 text-sm" : "btn-primary h-9 px-3 text-sm"}>
            {busy === "publish" ? <Spinner /> : null}
            {a.published ? "Unpublish" : "Publish to class"}
          </button>
        </div>
      </div>

      {a.flaggedLines.length > 0 && (
        <div className="mt-3 rounded-[10px] border border-warn-soft bg-warn-tint p-3 text-[13px] text-warn-dark">
          <p className="flex items-center gap-1.5 font-semibold">
            <Warn /> {a.flaggedLines.length} {a.flaggedLines.length === 1 ? "line was" : "lines were"} left out because {a.flaggedLines.length === 1 ? "it reads" : "they read"} like instructions to the AI
          </p>
          <ul className="mt-1.5 list-disc pl-5">
            {a.flaggedLines.map((l, i) => (
              <li key={i} className="font-mono text-[12px]">
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3 text-sm">
        <button type="button" aria-expanded={open === "problems"} onClick={() => toggle("problems")} className={`rounded-lg px-3 py-1.5 transition ${open === "problems" ? "bg-ink text-ground" : "hover:bg-ground"}`}>
          Problems
        </button>
        <button type="button" aria-expanded={open === "settings"} onClick={() => toggle("settings")} className={`rounded-lg px-3 py-1.5 transition ${open === "settings" ? "bg-ink text-ground" : "hover:bg-ground"}`}>
          Settings
        </button>
        <div className="flex-1" />
        <button type="button" onClick={remove} disabled={!!busy} className="rounded-lg px-3 py-1.5 text-warn transition hover:bg-warn-tint">
          {busy === "delete" ? "Deleting…" : "Delete"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-warn">
          {error}
        </p>
      )}

      {open === "problems" && (
        <ol className="mt-3 flex flex-col gap-3">
          {a.problems.map((p) => (
            <li key={p.id} className="rounded-[10px] border border-line p-3.5">
              <p className="eyebrow">Problem {p.position}</p>
              <p className="mt-1 whitespace-pre-wrap text-[14.5px]">{p.prompt}</p>
              <details className="mt-2 text-[13.5px]">
                <summary className="cursor-pointer text-accent-dark">What Ducky drafted (students never see this)</summary>
                <div className="mt-2 flex flex-col gap-2 text-sub">
                  <p>
                    <span className="font-semibold text-ink">Solution:</span> {p.solution}
                  </p>
                  {p.steps.length > 0 && (
                    <div>
                      <p className="font-semibold text-ink">Reasoning steps</p>
                      <ol className="list-decimal pl-5">
                        {p.steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {p.hints.length > 0 && (
                    <div>
                      <p className="font-semibold text-ink">Hints</p>
                      <ol className="list-decimal pl-5">
                        {p.hints.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {p.misconceptions.length > 0 && (
                    <div>
                      <p className="font-semibold text-ink">Likely misconceptions</p>
                      <ul className="list-disc pl-5">
                        {p.misconceptions.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}

      {open === "settings" && (
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={`${a.id}-due`}>Due date</label>
            <input id={`${a.id}-due`} type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-10 rounded-[10px] border border-edge bg-surface px-3" />
          </div>
          <PolicyFields policy={policy} onChange={(p) => setPolicy((cur) => ({ ...cur, ...p }))} idPrefix={a.id} />
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span role="status" className="text-sm text-accent-dark">
                Saved. Students get the new settings within seconds.
              </span>
            )}
            {dirty && (
              <button
                type="button"
                className="btn h-10 text-sm"
                onClick={() => {
                  setPolicy(a.policy);
                  setDue(toDateInput(a.dueAt));
                }}
              >
                Discard
              </button>
            )}
            <button type="button" onClick={save} disabled={!dirty || !!busy} className="btn-primary h-10 text-sm">
              {busy === "save" ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function UploadDialog({ classId, onClose }: { classId: string; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const size = files.reduce((n, f) => n + f.size, 0);
  const tooBig = size > MAX_UPLOAD_BYTES;
  const ready = title.trim().length > 0 && (files.length > 0 || text.trim().length > 0) && !tooBig;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("classId", classId);
    form.set("title", title.trim());
    if (due) form.set("dueDate", due);
    form.set("text", text);
    form.set("policy", JSON.stringify(policy));
    for (const f of files) form.append("files", f);
    try {
      const res = await fetch("/api/teacher/assignments", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
      router.refresh();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Dialog wide title="Upload problem set" subtitle="Ducky splits it into problems and drafts solutions, hints and misconceptions. It stays a draft until you publish it." onClose={busy ? () => {} : onClose}>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="min-w-0 flex-[2_1_240px]">
            <label htmlFor="ps-title" className="mb-1.5 block text-sm font-semibold">
              Title
            </label>
            <input
              id="ps-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Free fall"
              className="h-11 w-full rounded-[10px] border border-edge bg-surface px-3 placeholder:text-muted/60"
            />
          </div>
          <div className="flex-[1_1_150px]">
            <label htmlFor="ps-due" className="mb-1.5 block text-sm font-semibold">
              Due date <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id="ps-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-11 w-full rounded-[10px] border border-edge bg-surface px-3" />
          </div>
        </div>

        <div>
          <label htmlFor="ps-files" className="mb-1.5 block text-sm font-semibold">
            File
          </label>
          <input
            id="ps-files"
            type="file"
            multiple
            accept={ACCEPT}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-sm file:mr-3 file:h-10 file:cursor-pointer file:rounded-[10px] file:border file:border-edge file:bg-surface file:px-3 file:text-sm hover:file:bg-ground"
          />
          <p className={`mt-1 text-[12.5px] ${tooBig ? "text-warn" : "text-muted"}`}>
            PDF, photos (PNG, JPG) or a text file, up to 4 MB in total.{tooBig ? " These files are too large." : ""}
          </p>
        </div>

        <div>
          <label htmlFor="ps-text" className="mb-1.5 block text-sm font-semibold">
            Or paste the problems
          </label>
          <textarea
            id="ps-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={"1. A 1.0 kg ball and a 10 kg ball are dropped from rest at h = 20 m…\n2. …"}
            className="w-full rounded-[10px] border border-edge bg-surface p-3 text-[14px] placeholder:text-muted/60"
          />
        </div>

        <fieldset className="rounded-[12px] border border-line p-4">
          <legend className="px-1 text-sm font-semibold">Assignment settings</legend>
          <p className="mb-3 text-[12.5px] text-muted">You can change these any time, even after publishing.</p>
          <PolicyFields policy={policy} onChange={(p) => setPolicy((cur) => ({ ...cur, ...p }))} idPrefix="upload" />
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        )}
        <button type="submit" disabled={!ready || busy} className="btn-primary w-full">
          {busy ? (
            <>
              <Spinner /> Reading your problem set… this can take a minute
            </>
          ) : (
            "Upload and draft"
          )}
        </button>
      </form>
    </Dialog>
  );
}
