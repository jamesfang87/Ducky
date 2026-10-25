"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Plus, Send } from "@/components/ui/icons";
import type { TeacherClass } from "@/lib/classroom";
import { normalizeCourseNumber, isValidCourseNumber } from "@/lib/courseNumber";
import { useSession } from "@/lib/session";
import { Dialog, sendJson } from "./dialog";
import TeacherShell from "./TeacherShell";

export default function TeacherHome({ classes, loadError }: { classes: TeacherClass[]; loadError: string | null }) {
  const session = useSession();
  const [creating, setCreating] = useState(false);
  const close = useCallback(() => setCreating(false), []);

  return (
    <TeacherShell>
      <div className="pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{session?.name ?? "Teacher"} · Fall 2026</p>
            <h1 className="mt-1 font-display text-[32px] font-bold tracking-[-0.02em] md:text-[38px]">Your classes</h1>
            <p className="mt-1.5 text-sub">Create a class, share its code with students, then upload problem sets for Ducky to tutor.</p>
          </div>
          <button type="button" onClick={() => setCreating(true)} className="btn-primary">
            <Plus /> New class
          </button>
        </div>

        {loadError && (
          <p role="alert" className="mt-6 rounded-xl border border-warn-soft bg-warn-tint px-4 py-2.5 text-sm text-warn-dark">
            {loadError}
          </p>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {classes.map((c) => (
            <article key={c.id} className="card relative flex flex-col p-5 transition hover:border-accent hover:shadow-sm">
              <p className="eyebrow">{c.courseNumber ?? "Class"}</p>
              <h2 className="mt-1 font-display text-[20px] font-semibold leading-snug">
                <Link
                  href={`/teacher/classes/${c.id}`}
                  className="text-ink no-underline after:absolute after:inset-0 after:rounded-[14px] after:content-[''] hover:text-accent-dark focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent focus-visible:after:ring-offset-2"
                >
                  {c.name}
                </Link>
              </h2>
              <p className="mt-0.5 text-sm text-sub">
                {c.students} {c.students === 1 ? "student" : "students"} · {c.problemSets} {c.problemSets === 1 ? "problem set" : "problem sets"}
              </p>
              <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                <span className="text-[13px] text-muted">
                  Join code <span className="font-mono text-[14px] font-semibold tracking-[0.12em] text-ink">{c.joinCode}</span>
                </span>
                <span className="btn-primary h-9 flex-none px-3 text-sm">
                  Open class <Send size={13} />
                </span>
              </div>
            </article>
          ))}

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-[170px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-edge p-5 text-center transition hover:border-accent hover:bg-surface"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-accent shadow-sm">
              <Plus />
            </span>
            <span className="font-display text-[15px] font-semibold">Create a class</span>
            <span className="text-[12.5px] text-muted">You’ll get a 6-character code to share with students</span>
          </button>

          <Link
            href="/teacher/demo"
            className="card flex flex-col justify-center gap-1 p-5 text-ink no-underline transition hover:border-accent hover:shadow-sm"
          >
            <span className="eyebrow">Demo</span>
            <span className="font-display text-[17px] font-semibold">PHYS 1401 · Live dashboard</span>
            <span className="text-[13px] text-sub">Misconception heatmap, leak alert and transcripts on sample data.</span>
          </Link>
        </div>
      </div>

      {creating && <CreateClassDialog onClose={close} />}
    </TeacherShell>
  );
}

function CreateClassDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [courseNumber, setCourseNumber] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const course = normalizeCourseNumber(courseNumber);
  const valid = isValidCourseNumber(course) && name.trim().length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await sendJson<{ id: string }>("/api/teacher/classes", "POST", { courseNumber: course, name: name.trim() });
      router.push(`/teacher/classes/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Dialog title="New class" subtitle="Students join with the code you’ll get next." onClose={onClose}>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
        <div>
          <label htmlFor="course-number" className="mb-1.5 block text-sm font-semibold">
            Course number
          </label>
          <input
            id="course-number"
            autoFocus
            value={courseNumber}
            onChange={(e) => setCourseNumber(e.target.value.toUpperCase())}
            maxLength={20}
            placeholder="PHYS 1401"
            autoComplete="off"
            className="h-11 w-full rounded-[10px] border border-edge bg-surface px-3 font-mono uppercase placeholder:text-muted/60"
          />
          <p className="mt-1 text-[12.5px] text-muted">Letters, numbers, spaces, dots or dashes.</p>
        </div>
        <div>
          <label htmlFor="class-name" className="mb-1.5 block text-sm font-semibold">
            Class name
          </label>
          <input
            id="class-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Mechanics & Waves · Period 3"
            className="h-11 w-full rounded-[10px] border border-edge bg-surface px-3 placeholder:text-muted/60"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        )}
        <button type="submit" disabled={!valid || busy} className="btn-primary w-full">
          {busy ? "Creating…" : "Create class"}
        </button>
      </form>
    </Dialog>
  );
}
