"use client";

import Link from "next/link";
import { Check, Logo, Pencil, Search, Send, Warn } from "@/components/ui/icons";

const REASONING_STEPS = [
  {
    status: "done",
    text: "F = mg: gravity pulls the ball down with 69 N, the feather with 0.6 N.",
    tag: "69 N vs 0.6 N",
  },
  {
    status: "broke",
    text: "“More force, so the ball must fall faster.”",
    tag: "Mass changes fall speed",
    note: "Force isn’t acceleration. Something else grew along with the mass.",
  },
  {
    status: "fixed",
    text: "a = F/m: 69/7 and 0.6/0.06 both give 9.8 m/s². The mass cancels.",
    tag: "a = 9.8 m/s²",
  },
  {
    status: "done",
    text: "Both land at t = √(2h/g) ≈ 0.64 s. In air, drag — not weight — separates them.",
    tag: "t ≈ 0.64 s",
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
  return (
    <div className="min-h-screen text-base">
      <header className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-4 px-6 py-5">
        <Logo />
        <div className="flex-1" />
        <Link href="/login" className="text-sub no-underline hover:text-ink">Login</Link>
        <a href="#privacy" className="text-sub no-underline hover:text-ink">Privacy</a>
      </header>

      <main className="mx-auto max-w-[1240px] px-6 pb-16 pt-6 md:pt-10">
        <h1 className="font-display text-[40px] font-bold leading-[1.04] tracking-[-0.03em] md:text-[60px]">
          Talk it through.
          <br />
          Ducky finds where it broke.
        </h1>
        <p className="mt-5 text-[19px] text-sub">
          Ducky is a learning management system where students explain their work out loud and teachers see where the
          class gets stuck.
        </p>

        <div className="card mt-10 rounded-[20px] p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow mb-1">A reasoning path · PHYS 1401</p>
              <h2 className="font-display text-xl font-semibold leading-snug md:text-2xl">
                A 7 kg bowling ball and a 60 g feather drop from 2 m. Which lands first?
              </h2>
            </div>
            <div className="flex flex-none flex-wrap gap-1.5">
              <span className="chip">Hint 1 of 2</span>
              <span className="chip">Voice required</span>
            </div>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col gap-6">
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
                        <p className="text-[14px] leading-snug text-warn-dark">{s.text}</p>
                        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-warn">
                          <Warn size={12} className="mt-[1px] flex-none" /> Misconception · {s.tag}
                        </p>
                        <p className="mt-1 text-[12.5px] leading-snug text-warn">{s.note}</p>
                      </div>
                    ) : (
                      <div
                        className={`flex items-baseline justify-between gap-3 ${
                          s.status === "fixed" ? "rounded-[10px] bg-accent-tint px-3 py-2" : ""
                        }`}
                      >
                        <p
                          className={`text-[14px] leading-snug ${
                            s.status === "fixed" ? "font-medium text-accent-dark" : "text-sub"
                          }`}
                        >
                          {s.text}
                        </p>
                        <span
                          className={`hidden flex-none rounded border px-1.5 py-0.5 font-mono text-[11px] sm:inline-block ${
                            s.status === "fixed" ? "border-accent/30 text-accent-dark" : "border-line text-muted"
                          }`}
                        >
                          {s.tag}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
              </ol>

              <p className="rounded-[10px] bg-ground px-3 py-2.5 text-[14px] leading-snug text-sub">
                <span className="font-semibold text-ink">Ducky:</span> In air, gravity on the feather hasn’t changed.
                What else is pushing on it?
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-line bg-ground p-4">
                <svg
                  viewBox="0 0 320 152"
                  className="block h-auto w-full"
                  role="img"
                  aria-label="A bowling ball and a feather side by side, with equal downward arrows, both reaching the ground at the same time."
                >
                  <path d="M22 20v110" stroke="#C9CCC6" strokeWidth="1.5" strokeDasharray="4 4" />
                  <text x="28" y="18" fontFamily="var(--font-inter)" fontSize="10" fill="#5A626C">h = 2 m</text>
                  <path d="M12 134h296" stroke="#C9CCC6" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="92" cy="50" r="17" fill="#14171C" />
                  <text x="92" y="54" textAnchor="middle" fontFamily="var(--font-inter)" fontSize="9" fill="#FFFFFF">7 kg</text>
                  <path d="M228 34c11 6 15 17 10 27-9-2-15-8-17-17z" fill="#F2B705" stroke="#C99100" strokeWidth="1.5" />
                  <text x="228" y="76" textAnchor="middle" fontFamily="var(--font-inter)" fontSize="9" fill="#3A414A">60 g</text>
                  <path d="M92 84v34m-4-5 4 5 4-5" stroke="#0B7A62" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M228 84v34m-4-5 4 5 4-5" stroke="#0B7A62" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <text x="300" y="150" textAnchor="end" fontFamily="var(--font-inter)" fontSize="10" fill="#5A626C">t ≈ 0.64 s</text>
                </svg>
                <p className="mt-2 text-center text-[12.5px] text-muted">Equal arrows: both fall at 9.8 m/s² and land together.</p>
              </div>

              <div className="rounded-xl border border-line p-3.5 text-[12.5px] leading-snug">
                <p className="flex items-center gap-1.5 font-semibold text-ink">
                  <Pencil size={12} /> Generated a free-body diagram
                </p>
                <p className="mt-1.5 flex items-start gap-1.5 text-muted">
                  <Search size={12} className="mt-0.5 flex-none" />
                  Reviewer: the ball’s arrow is longer than the feather’s, so the diagram implies different
                  accelerations.
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-accent-dark">
                  <Check size={11} /> Fixed on pass 2 of 3, then approved.
                </p>
              </div>

              <a
                href="https://www.google.com/search?q=apollo+15+hammer+feather"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-[13px] no-underline transition hover:bg-ground"
              >
                <span>
                  <span className="text-muted">Real world · SerpApi:</span>{" "}
                  <span className="font-medium text-ink">Apollo 15 dropped a hammer and a feather on the Moon</span>
                </span>
                <Send size={14} className="flex-none text-muted" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
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
