"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo, Student, Teacher, User } from "@/components/ui/icons";

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
              <svg viewBox="0 0 420 120" className="block h-auto w-full" role="img" aria-label="Four reasoning steps on a line; step three is where the reasoning broke and was corrected.">
                <path d="M20 90 C80 90 90 40 150 40 S230 95 280 70 S360 30 400 30" stroke="#0B7A62" strokeWidth="3" fill="none" strokeLinecap="round" />
                <circle cx="20" cy="90" r="7" fill="#0B7A62" />
                <circle cx="150" cy="40" r="7" fill="#0B7A62" />
                <circle cx="250" cy="82" r="9" fill="#A3530A" />
                <circle cx="400" cy="30" r="7" fill="#0B7A62" />
                <g fontFamily="var(--font-inter)" fontSize="11" fill="#3A414A">
                  <text x="6" y="114">arrays</text>
                  <text x="122" y="22">index → O(1)</text>
                  <text x="206" y="112">“just search keys”</text>
                  <text x="350" y="56">hash → index</text>
                </g>
              </svg>
              <div className="mt-4 flex flex-col gap-2.5 text-[15px]">
                <div className="rounded-[10px] bg-ground px-3 py-2.5">
                  <span className="font-semibold">Ducky:</span> Indexing an array is fast because you compute the position.
                  What if your key is a string, not a number?
                </div>
                <div className="max-w-[85%] self-end rounded-[10px] bg-ink px-3 py-2.5 text-white">
                  So… a hash function turns the string into an index!
                </div>
              </div>
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
