"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clock, useRecorder } from "@/lib/useRecorder";

interface Segment {
  start: number;
  end: number;
  label: string;
  text: string;
  steps: number[];
  misconceptions: string[];
  hidden: boolean;
}
interface Res {
  kind: "video" | "page";
  title: string;
  link: string;
  source: string;
  length?: string;
  fit: "same" | "different";
  why: string;
  on: boolean;
}
interface Note {
  id: string;
  problemId: string;
  problemLabel: string;
  author: { name: string; role: "teacher" | "student" };
  status: "live" | "pending" | "hidden";
  createdAt: number;
  seconds: number;
  title: string;
  summary: string;
  keyIdeas: string[];
  checkQuestion: string;
  segments: Segment[];
  review: { accurate: boolean; issues: string[] };
  resources: Res[];
  plays: string[];
  helped: string[];
}
interface Stuck {
  sessionId: string;
  misconception: string;
  label: string;
  problemLabel: string;
  students: number;
}
interface Data {
  notes: Note[];
  stuck: Stuck[];
  problems: { id: string; group: string; label: string }[];
  maxSeconds: number;
  matching: boolean;
}

const STAGES = ["Transcribing with Muse Voice", "Mapping it to the problem's steps", "Checking it against the solution", "Finding videos that explain it your way"];

export default function VoiceNotes() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [problemId, setProblemId] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const rec = useRecorder(data?.maxSeconds ?? 120);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/teacher/voice-notes", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn't load voice notes.");
      setData(j);
      setError("");
      setProblemId((p) => p || j.problems.find((x: { id: string }) => x.id === "demo-cs-bst-p1")?.id || j.problems[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load voice notes.");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!busy) return;
    setStage(0);
    const t = setInterval(() => setStage((s) => Math.min(STAGES.length - 1, s + 1)), 6_000);
    return () => clearInterval(t);
  }, [busy]);

  const groups = useMemo(() => {
    const m = new Map<string, { id: string; label: string }[]>();
    for (const p of data?.problems ?? []) m.set(p.group, [...(m.get(p.group) ?? []), p]);
    return [...m.entries()];
  }, [data]);

  const record = async () => {
    setUploadError("");
    const wav = await rec.start();
    if (!wav) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/teacher/voice-notes?problemId=${encodeURIComponent(problemId)}`, { method: "POST", headers: { "content-type": "audio/wav" }, body: wav });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Couldn't save that note.");
      setFocus(j.note.id);
      await load();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Couldn't save that note.");
    } finally {
      setBusy(false);
    }
  };

  const act = async (id: string, body: Record<string, unknown>) => {
    await fetch("/api/teacher/voice-notes", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    await load();
  };

  if (error) return <p className="text-warn">{error}</p>;
  if (!data) return <p className="text-muted">Loading voice notes…</p>;

  const tips = data.notes.filter((n) => n.author.role === "student" && n.status === "pending");
  const mine = data.notes.filter((n) => !(n.author.role === "student" && n.status === "pending"));
  const reached = new Set(data.notes.flatMap((n) => n.plays)).size;
  const helped = new Set(data.notes.flatMap((n) => n.helped)).size;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[30px] font-bold tracking-tight">Voice notes</h1>
        <p className="mt-1 max-w-[640px] text-sub">
          Say it once, your way. Ducky plays the right 20 seconds to every student who gets stuck on that step, right when they get stuck, and asks its next question in your words.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Stat value={data.notes.filter((n) => n.status === "live").length} label="notes live" />
          <Stat value={reached} label="students reached" />
          <Stat value={helped} label="got unstuck after listening" />
        </div>
      </div>

      {data.stuck.length > 0 && (
        <section className="card p-5">
          <h2 className="h2">Where students are stuck right now</h2>
          <p className="mt-1 text-sm text-muted">Misconceptions Ducky has flagged and nobody has fixed yet. One note answers all of them.</p>
          <ul className="mt-3 divide-y divide-line">
            {data.stuck.map((s) => {
              const covered = data.notes.some((n) => n.problemId === s.sessionId && n.status === "live" && n.segments.some((g) => g.misconceptions.includes(s.misconception)));
              return (
                <li key={`${s.sessionId}-${s.misconception}`} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.label}</p>
                    <p className="text-[13px] text-muted">{s.problemLabel}</p>
                  </div>
                  <span className="text-sm text-sub">
                    {s.students} student{s.students === 1 ? "" : "s"}
                  </span>
                  {covered ? (
                    <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">Your note covers this</span>
                  ) : (
                    <button
                      type="button"
                      className="btn h-8 px-3 text-sm"
                      onClick={() => {
                        setProblemId(s.sessionId);
                        document.getElementById("vn-recorder")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                    >
                      Record for this
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section id="vn-recorder" className="card p-5">
        <h2 className="h2">Record a note</h2>
        <label className="mt-3 block text-sm font-semibold" htmlFor="vn-problem">
          Problem
        </label>
        <select
          id="vn-problem"
          value={problemId}
          onChange={(e) => setProblemId(e.target.value)}
          disabled={rec.recording || busy}
          className="mt-1 h-10 w-full rounded-[10px] border border-edge bg-surface px-3 text-sm"
        >
          {groups.map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-2 text-[13px] text-muted">
          Explain it like you would at the board, up to {clock(data.maxSeconds)}. Cover a few steps or the mistakes you keep seeing. If you say the final answer, Ducky cuts that part so students never hear it.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          {rec.recording ? (
            <button type="button" className="btn-primary h-11 px-5" onClick={rec.stop}>
              Stop and process
            </button>
          ) : (
            <button type="button" className="btn-primary h-11 px-5" onClick={() => void record()} disabled={busy || !problemId}>
              {busy ? "Processing…" : "Start recording"}
            </button>
          )}
          {rec.recording && (
            <>
              <span className="flex h-3 w-40 overflow-hidden rounded-full bg-line" aria-hidden>
                <span className="block h-full bg-accent transition-[width] duration-100" style={{ width: `${Math.round(rec.level * 100)}%` }} />
              </span>
              <span className="font-mono text-sm text-sub">
                {clock(rec.seconds)} / {clock(data.maxSeconds)}
              </span>
            </>
          )}
        </div>
        {busy && (
          <ol className="mt-4 flex flex-col gap-1.5 text-sm" aria-live="polite">
            {STAGES.filter((_, i) => i < 3 || data.matching).map((s, i) => (
              <li key={s} className={i < stage ? "text-sub" : i === stage ? "font-semibold" : "text-muted"}>
                {i < stage ? "✓ " : i === stage ? "… " : ""}
                {s}
              </li>
            ))}
          </ol>
        )}
        {(rec.error || uploadError) && <p className="mt-3 text-sm text-warn">{rec.error ?? uploadError}</p>}
      </section>

      {tips.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="h2">Tips from students, waiting for you</h2>
          <p className="-mt-2 text-sm text-muted">Students who got past a step recorded what made it click. Approve one and the next classmate stuck there hears it.</p>
          {tips.map((n) => (
            <NoteCard key={n.id} note={n} open act={act} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="h2">Your notes</h2>
        {mine.length === 0 && <p className="text-sm text-muted">No notes yet. Record one above: try the BST problem and explain inorder traversal the way you would in class.</p>}
        {mine.map((n) => (
          <NoteCard key={n.id} note={n} open={n.id === focus} act={act} />
        ))}
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[12px] border border-line bg-surface px-4 py-2.5">
      <p className="font-display text-2xl font-semibold">{value}</p>
      <p className="text-[13px] text-muted">{label}</p>
    </div>
  );
}

const STATUS: Record<Note["status"], string> = { live: "Live", pending: "Waiting for you", hidden: "Hidden" };

function NoteCard({ note, open: initiallyOpen, act }: { note: Note; open?: boolean; act: (id: string, body: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(!!initiallyOpen);
  useEffect(() => setOpen((o) => o || !!initiallyOpen), [initiallyOpen]);
  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{note.problemLabel}</p>
          <h3 className="mt-0.5 text-lg font-semibold">{note.title}</h3>
          <p className="text-[13px] text-muted">
            {note.author.role === "teacher" ? note.author.name : `${note.author.name} (student)`} · {clock(note.seconds)} · {note.plays.length} played · {note.helped.length} got unstuck
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${note.status === "live" ? "bg-accent/15 text-accent" : note.status === "pending" ? "bg-warn/15 text-warn" : "bg-line text-muted"}`}>
          {STATUS[note.status]}
        </span>
      </div>
      <p className="mt-2 text-sm text-sub">{note.summary}</p>
      {!note.review.accurate && (
        <div className="mt-3 rounded-[10px] border border-warn/40 bg-warn/10 p-3 text-sm">
          <p className="font-semibold text-warn">Muse found something that doesn’t match the solution</p>
          <ul className="mt-1 list-disc pl-5 text-sub">
            {note.review.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}
      <audio controls preload="none" src={`/api/voice-notes/audio?id=${encodeURIComponent(note.id)}`} className="mt-3 w-full" />

      <button type="button" className="mt-3 text-sm font-semibold text-accent hover:text-accent-dark" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Hide details" : `How Ducky will use it (${note.segments.length} part${note.segments.length === 1 ? "" : "s"})`}
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-4">
          <ol className="flex flex-col gap-2">
            {note.segments.map((s, i) => (
              <li key={i} className={`rounded-[10px] border p-3 ${s.hidden ? "border-warn/40 bg-warn/5" : "border-line"}`}>
                <p className="text-sm font-semibold">
                  <span className="font-mono text-xs text-muted">
                    {clock(s.start)}–{clock(s.end)}
                  </span>{" "}
                  {s.label}
                </p>
                <p className="mt-1 text-[13px] text-sub">“{s.text}”</p>
                <p className="mt-1.5 text-[12px] text-muted">
                  {s.hidden
                    ? "Cut: this part says the final answer, so students won't hear it."
                    : [s.steps.length ? `Plays on step ${s.steps.map((x) => x + 1).join(", ")}` : "", s.misconceptions.length ? `When a student shows: ${s.misconceptions.join(", ").replace(/[-_]/g, " ")}` : ""]
                        .filter(Boolean)
                        .join(" · ") || "Not tied to a step"}
                </p>
              </li>
            ))}
          </ol>
          {note.checkQuestion && (
            <p className="text-sm">
              <span className="font-semibold">Ducky’s follow-up, in your words: </span>
              <span className="text-sub">{note.checkQuestion}</span>
            </p>
          )}
          {note.resources.length > 0 && (
            <div>
              <p className="text-sm font-semibold">Matched to how you explained it</p>
              <p className="text-[12px] text-muted">SerpApi searched YouTube and the web; Muse compared each one to your note. Students see the ones you leave on.</p>
              <ul className="mt-2 flex flex-col gap-2">
                {note.resources.map((r) => (
                  <li key={r.link} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={r.on}
                      onChange={(e) => void act(note.id, { action: "resource", link: r.link, on: e.target.checked })}
                      className="mt-1"
                      aria-label={`Show "${r.title}" to students`}
                    />
                    <div className="min-w-0">
                      <a href={r.link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent no-underline hover:text-accent-dark">
                        {r.title}
                      </a>
                      <p className="text-[12px] text-muted">
                        {r.kind === "video" ? `Video${r.length ? ` · ${r.length}` : ""}` : "Page"} · {r.source} ·{" "}
                        <span className={r.fit === "same" ? "font-semibold text-accent" : "font-semibold text-warn"}>{r.fit === "same" ? "Same approach" : "Different approach"}</span>
                      </p>
                      {r.why && <p className="text-[13px] text-sub">{r.why}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {note.status !== "live" && (
          <button type="button" className="btn-primary h-9 px-3 text-sm" onClick={() => void act(note.id, { action: "live" })}>
            {note.author.role === "student" ? "Approve for classmates" : "Make live"}
          </button>
        )}
        {note.status === "live" && (
          <button type="button" className="btn h-9 px-3 text-sm" onClick={() => void act(note.id, { action: "hide" })}>
            Hide
          </button>
        )}
        <button
          type="button"
          className="btn h-9 px-3 text-sm"
          onClick={() => {
            if (window.confirm("Delete this note and its recording?")) void act(note.id, { action: "delete" });
          }}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
