"use client";

import Link from "next/link";
import { AccountChip } from "@/components/ui/AccountChip";
import { Logo, Spinner } from "@/components/ui/icons";
import { CLASS_BY_ID, getClassSummary } from "@/lib/classes";
import { useSession } from "@/lib/session";
import { useEnrolledClasses } from "@/lib/useClasses";
import { ProblemSetCard } from "./ProblemSetCard";

/** One class: every problem set the teacher posted, each opening its tutoring session. */
export default function ClassView({ classId }: { classId: string }) {
  const session = useSession();
  const record = CLASS_BY_ID[classId];
  const { classes, ready } = useEnrolledClasses();
  const enrolled = classes.some((item) => item.id === classId);

  if (!record) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md p-6 text-center">
          <p className="font-display text-lg font-semibold">Class not found</p>
          <p className="mt-1 text-sm text-sub">That class isn’t in the catalog anymore.</p>
          <Link href="/classes" className="btn-primary mt-4 inline-flex px-4 no-underline">
            Back to my classes
          </Link>
        </div>
      </div>
    );
  }

  // The stored enrollment list is read after hydration; wait for it before
  // claiming the student isn't in the class.
  if (!ready && !enrolled) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted" role="status">
        <Spinner size={18} className="text-accent" /> Opening {record.course}…
      </div>
    );
  }

  if (!enrolled) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md p-6 text-center">
          <p className="font-display text-lg font-semibold">You’re not in this class</p>
          <p className="mt-1 text-sm text-sub">
            Ask {record.teacher} for the class code, then join from My classes.
          </p>
          <Link href="/classes" className="btn-primary mt-4 inline-flex px-4 no-underline">
            Back to my classes
          </Link>
        </div>
      </div>
    );
  }

  const { sets, problems, completed, pct, due } = getClassSummary(record);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1120px] items-center gap-4 px-6 py-3.5">
          <Logo />
          <div className="flex-1" />
          <AccountChip />
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-6 pb-16 pt-8">
        <Link href="/classes" className="inline-flex items-center gap-1.5 text-sm text-sub no-underline transition hover:text-ink">
          <span aria-hidden="true">←</span> My classes
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">
              {record.course} · {record.term}
            </p>
            <h1 className="mt-1 font-display text-[32px] font-bold tracking-[-0.02em] md:text-[38px]">{record.name}</h1>
            <p className="mt-1.5 text-sub">
              {record.teacher} · Join code <span className="font-mono text-[13px] text-ink">{record.joinCode}</span>
            </p>
          </div>
          <div className="card min-w-[150px] px-4 py-3">
            <p className="eyebrow">Your progress</p>
            <p className="mt-0.5 font-display text-[22px] font-semibold">
              {completed} <span className="text-[15px] font-normal text-muted">of {problems}</span>
            </p>
            <p className="text-[12.5px] text-muted">{due ? `Next due ${due}` : "Nothing due right now"}</p>
          </div>
        </div>

        {problems > 0 && (
          <div className="mt-6">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-ground"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${record.name} progress`}
            >
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-[12.5px] text-muted">
              {session?.name ? `${session.name} · ` : ""}
              {pct}% of problems complete
            </p>
          </div>
        )}

        <section aria-labelledby="psets-title" className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="psets-title" className="font-display text-[22px] font-semibold">
                Problem sets
              </h2>
              <p className="mt-0.5 text-sm text-sub">
                Posted by {record.teacher}. Pick one to talk it through with Ducky.
              </p>
            </div>
            <span className="chip">
              {sets.length} posted
            </span>
          </div>

          {sets.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {sets.map((set) => (
                <div key={set.id} id={set.id} className="scroll-mt-6">
                  <ProblemSetCard set={set} />
                </div>
              ))}
            </div>
          ) : (
            <div className="card mt-4 flex flex-col items-center gap-3 p-10 text-center">
              <p className="font-display text-lg font-semibold">No problem sets yet</p>
              <p className="max-w-[380px] text-sm text-sub">
                {record.teacher} hasn’t posted anything to this class yet. It will show up here as soon as they do.
              </p>
              <Link href="/classes" className="btn mt-1 h-10 px-4 no-underline">
                Back to my classes
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
