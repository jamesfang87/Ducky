"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo, Student, Teacher, User, Check } from "@/components/ui/icons";

const REASONING_STEPS = [
  {
    status: "done",
    text: "A list of 1,000 names: finding one means checking names one at a time.",
    cost: "O(n)",
  },
  {
    status: "done",
    text: "If the name were a number 0–999, names[482] is a single jump.",
    cost: "O(1)",
  },
  {
    status: "broke",
    text: "“So sorting the list is what makes lookup instant.”",
    cost: "O(log n)",
    note: "Closer, but log n still grows with the list. Instant means no searching at all.",
  },
  {
    status: "fixed",
    text: "Hash “Ana” → 482. Jump straight to bucket 482, and nothing else gets compared.",
    cost: "O(1)",
  },
] as const;

function StepMarker({ status }: { status: (typeof REASONING_STEPS)[number]["status"] }) {
  if (status === "broke") {
    return (
      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-warn text-[11px] font-bold text-white">
        !
      </span>
    );
  }
  if (status === "fixed") {
    return (
      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 border-accent bg-accent-tint text-accent">
        <Check size={9} />
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent text-white">
      <Check size={10} />
    </span>
  );
}

export default function Landing() {
  const [role, setRole] = useState<"student" | "teacher">("student");
  const router = useRouter();

  // TODO: replace with supabase.auth.signInWithOAuth({ provider: "google" }) and route by profile.role
  const signIn = () => router.push(role === "student" ? "/session/demo" : "/teacher");

  return (
    <div className="min-h-screen text-base">
      <header className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-4 px-6 py-5">
        <Logo />
        <div className="flex-1" />
        <Link href="/teacher" className="text-sub no-underline hover:text-ink">For schools</Link>
        <a href="#privacy" className="text-sub no-underline hover:text-ink">Privacy</a>
      </header>

      <main className="mx-auto max-w-[1240px] px-6 pb-16 pt-6 md:pt-10">
        <div className="flex flex-wrap items-center gap-12">
          <div className="min-w-0 flex-[1_1_440px]">
            <p className="mb-4 inline-block rounded-full bg-accent-tint px-3 py-1 text-sm font-medium text-accent-dark">
              Rubber-duck debugging for every subject
            </p>
            <h1 className="font-display text-[40px] font-bold leading-[1.04] tracking-[-0.03em] md:text-[60px]">
              Talk it through.
              <br />
              Ducky finds where it broke.
            </h1>
            <p className="mt-5 max-w-[520px] text-[19px] text-sub">
              Explain your reasoning out loud. Ducky asks why behind each step, shows you a visual when words aren’t
              enough, and never just hands over the answer.
            </p>

            <div className="card mt-8 max-w-[420px] rounded-2xl p-5">
              <p className="mb-2.5 text-sm font-semibold">I’m a…</p>
              <div role="group" aria-label="Role" className="grid grid-cols-2 gap-1.5 rounded-xl bg-ground p-1">
                {(["student", "teacher"] as const).map((r) => {
                  const Icon = r === "student" ? Student : Teacher;
                  return (
                    <button
                      key={r}
                      aria-pressed={role === r}
                      onClick={() => setRole(r)}
                      className={`flex h-11 items-center justify-center gap-2 rounded-[9px] capitalize transition ${
                        role === r ? "bg-white font-semibold shadow-sm" : "text-sub hover:text-ink"
                      }`}
                    >
                      <Icon className={role === r ? "text-accent" : "text-muted"} />
                      {r}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={signIn}
                className="mt-3.5 flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl bg-ink font-semibold text-white transition hover:bg-sub"
              >
                <User /> Continue with Google
              </button>
              <p id="privacy" className="mt-3 text-[13px] text-muted">
                Use your school account. Your sessions belong to you, and student data is never used to train AI models.
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-[1_1_420px]">
            <div className="card rounded-[20px] p-6">
              <p className="eyebrow mb-1">A reasoning path</p>
              <p className="mb-4 font-display text-xl font-semibold">Why does a hash map lookup feel instant?</p>
              <ol className="flex flex-col">
                {REASONING_STEPS.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <StepMarker status={s.status} />
                      {i < REASONING_STEPS.length - 1 && <span aria-hidden className="my-1 w-px flex-1 bg-line" />}
                    </div>
                    <div className={`min-w-0 flex-1 ${i < REASONING_STEPS.length - 1 ? "pb-4" : ""}`}>
                      {s.status === "broke" ? (
                        <div className="rounded-[10px] bg-warn-tint px-3 py-2">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-[14px] leading-snug text-warn-dark">{s.text}</p>
                            <span className="flex-none rounded border border-warn/30 px-1.5 py-0.5 font-mono text-[11px] text-warn">{s.cost}</span>
                          </div>
                          <p className="mt-1 text-[12.5px] leading-snug text-warn">{s.note}</p>
                        </div>
                      ) : (
                        <div className={s.status === "fixed" ? "rounded-[10px] bg-accent-tint px-3 py-2" : ""}>
                          <div className="flex items-baseline justify-between gap-3">
                            <p className={`text-[14px] leading-snug ${s.status === "fixed" ? "font-medium text-accent-dark" : "text-sub"}`}>
                              {s.text}
                            </p>
                            <span
                              className={`flex-none rounded border px-1.5 py-0.5 font-mono text-[11px] ${
                                s.status === "fixed" ? "border-accent/30 text-accent-dark" : "border-line text-muted"
                              }`}
                            >
                              {s.cost}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-4 rounded-[10px] bg-ground px-3 py-2.5 text-[14px] leading-snug text-sub">
                <span className="font-semibold text-ink">Ducky:</span> You went from “sorted” to “instant.” What has to
                happen to “Ana” before the jump?
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          {[
            ["Say it to learn it", "Voice-first sessions build active recall. You’ll often catch your own mistake mid-sentence."],
            ["Visuals, double-checked", "Diagrams and simulations are generated, rendered, then reviewed by a second model before you see them."],
            ["Teachers set the rules", "Hint limits, answer reveal, voice and tone per assignment, plus a live misconception map for the class."],
          ].map(([h, p]) => (
            <div key={h} className="card rounded-2xl p-5">
              <h2 className="mb-1.5 font-display text-[19px] font-semibold">{h}</h2>
              <p className="text-[15px] text-sub">{p}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
