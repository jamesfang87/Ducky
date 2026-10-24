"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Check, DuckMark, Logo, Mic, Pencil, Search, Send, Warn } from "@/components/ui/icons";

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

// Which scroll beat reveals each reasoning step.
const STEP_BEAT = [0, 1, 2, 2];

const BEATS = [
  { eyebrow: "Explain", title: "Students talk it through.", body: "Out loud, step by step, in their own words." },
  { eyebrow: "Catch", title: "Ducky hears where it broke.", body: "Misconceptions are named the moment they show up." },
  { eyebrow: "Fix", title: "Then they fix it themselves.", body: "A hint, never the answer. The correction is theirs." },
  { eyebrow: "Check", title: "Every visual gets a second look.", body: "A second model reviews each diagram before a student sees it." },
  { eyebrow: "Ask", title: "And it keeps asking.", body: "One more question, until the idea actually holds up." },
] as const;

// What the student is saying out loud at each beat.
const TRANSCRIPT = [
  "So gravity pulls the ball with 69 newtons, and the feather with only 0.6…",
  "More force on the ball, so it has to fall faster. Right?",
  "Wait. a is F over m. Both come out to 9.8, so the mass cancels.",
  "Can I see the forces drawn out?",
  "If gravity on it is the same… is the air pushing back on the feather?",
];

const STAT_GROUPS = [
  {
    label: "The problem",
    tone: "text-[#FF8A7A]",
    stats: [
      {
        figure: "~¼",
        claim: "of students’ conceptual gap in physics is all a typical lecture course closes.",
        source: "Hake, 1998 (average normalized gain 0.23)",
      },
      {
        figure: "48%",
        claim: "of students who start a STEM bachelor’s degree leave the field.",
        source: "Chen, NCES 2013",
      },
    ],
  },
  {
    label: "What works",
    tone: "text-accent-glow",
    stats: [
      {
        figure: "98th",
        claim: "percentile: where 1-on-1 tutoring moved the average student, versus a lecture class.",
        source: "Bloom, 1984. Later reviews put the effect near 0.8 SD, still large.",
      },
      {
        figure: "2×",
        claim: "the conceptual gains on the Force Concept Inventory when courses make students articulate their reasoning.",
        source: "Hake, 1998; Crouch & Mazur, 2001",
      },
    ],
  },
] as const;

const PRINCIPLES = [
  {
    title: "Saying it catches it",
    body: "Students who explain their reasoning build more accurate mental models than those who just read solutions. So Ducky asks students to talk through their work instead of pasting in an answer.",
    source: "Self-explanation effect · Chi et al., 1989, 1994",
  },
  {
    title: "Words and pictures together",
    body: "People learn more from explanations paired with visuals than from words alone. Every diagram and simulation Ducky shows is checked by a second model first.",
    source: "Multimedia principle · Mayer, 2009",
  },
  {
    title: "Misconceptions don’t leave on their own",
    body: "Ideas like “heavier things fall faster” survive lectures. Ducky names each one as it shows up and puts it on the teacher’s heatmap.",
    source: "Force Concept Inventory · Hestenes et al., 1992",
  },
] as const;

const SCREEN_W = 1280;
const SCREEN_H = 800;

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// enter: 0 when the section's top is at the bottom of the viewport, 1 once it reaches the top.
// progress: 0 to 1 across the stretch where the section's sticky child is pinned.
function useSectionScroll(ref: RefObject<HTMLElement | null>) {
  const [state, setState] = useState({ enter: 0, progress: 0 });
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const span = r.height - vh;
      setState({ enter: clamp(1 - r.top / vh), progress: span > 0 ? clamp(-r.top / span) : 1 });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);
  return state;
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`motion-safe:transition motion-safe:duration-700 motion-safe:ease-out ${
        shown ? "translate-y-0 opacity-100" : "motion-safe:translate-y-8 motion-safe:opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

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

// Renders children at a fixed desktop resolution and scales them to fit the screen, like a real display.
function ScaledScreen({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / SCREEN_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative aspect-[16/10] overflow-hidden rounded-[4px] bg-ground">
      <div
        className="absolute left-0 top-0"
        style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${scale})`, transformOrigin: "0 0", visibility: scale ? "visible" : "hidden" }}
      >
        {children}
      </div>
    </div>
  );
}

function Laptop({ open, children }: { open: number; children: ReactNode }) {
  return (
    <div
      className="relative"
      style={{
        width: "min(92vw, 1040px, calc((100svh - 3rem - 230px) * 1.5))",
        perspective: "2400px",
        transform: `scale(${0.84 + 0.16 * open})`,
      }}
    >
      <div
        className="rounded-t-[2.2%_3.4%] bg-[#0e0f11] p-[1.3%] pb-[1.6%] shadow-[0_40px_80px_-30px_rgba(20,23,28,0.45)] ring-1 ring-[#2a2c30]"
        style={{ transform: `rotateX(${-88 * (1 - open)}deg)`, transformOrigin: "50% 100%" }}
      >
        <div className="mx-auto mb-[0.8%] h-[5px] w-[5px] rounded-full bg-[#26282c]" aria-hidden />
        <ScaledScreen>{children}</ScaledScreen>
      </div>
      <div
        aria-hidden
        className="relative -mx-[7%] h-[clamp(10px,1.5vw,18px)] rounded-b-[40%_100%] bg-gradient-to-b from-[#e4e5e7] via-[#c9cbce] to-[#9ea1a6]"
      >
        <div className="absolute left-1/2 top-0 h-[45%] w-[13%] -translate-x-1/2 rounded-b-[8px] bg-[#b6b8bc]" />
      </div>
    </div>
  );
}

function DemoScreen({ beat }: { beat: number }) {
  const show = (b: number) =>
    `motion-safe:transition motion-safe:duration-500 ${beat >= b ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`;

  return (
    <div className="flex h-full flex-col text-[15px] text-ink">
      <div className="flex h-12 flex-none items-center gap-3 border-b border-line bg-white px-6">
        <DuckMark size={22} />
        <span className="font-display text-[17px] font-bold tracking-tight">ducky</span>
        <span className="ml-3 text-[13px] text-muted">PHYS 1401 · Free fall · Problem 3</span>
        <div className="flex-1" />
        <span className="chip">Hint 1 of 2</span>
        <span className="chip">Voice required</span>
      </div>

      <div className="flex-1 px-10 py-8">
        <p className="eyebrow mb-1">A reasoning path</p>
        <h2 className="font-display text-[26px] font-semibold leading-snug">
          A 7 kg bowling ball and a 60 g feather drop from 2 m. Which lands first?
        </h2>

        <div className="mt-7 grid grid-cols-[1.05fr_0.95fr] gap-8">
          <div className="flex flex-col gap-6">
            <ol className="flex flex-col">
              {REASONING_STEPS.map((s, i) => (
                <li key={i} className={`flex gap-3 ${show(STEP_BEAT[i])}`}>
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
                        <p className={`text-[14px] leading-snug ${s.status === "fixed" ? "font-medium text-accent-dark" : "text-sub"}`}>
                          {s.text}
                        </p>
                        <span
                          className={`flex-none rounded border px-1.5 py-0.5 font-mono text-[11px] ${
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

            <p className={`rounded-[10px] bg-white px-3 py-2.5 text-[14px] leading-snug text-sub ring-1 ring-line ${show(4)}`}>
              <span className="font-semibold text-ink">Ducky:</span> In air, gravity on the feather hasn’t changed. What else
              is pushing on it?
            </p>
          </div>

          <div className={`flex flex-col gap-3 ${show(3)}`}>
            <div className="rounded-xl border border-line bg-white p-4">
              <svg viewBox="0 0 320 152" className="block h-auto w-full" aria-hidden="true">
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

            <div className="rounded-xl border border-line bg-white p-3.5 text-[12.5px] leading-snug">
              <p className="flex items-center gap-1.5 font-semibold text-ink">
                <Pencil size={12} /> Generated a free-body diagram
              </p>
              <p className="mt-1.5 flex items-start gap-1.5 text-muted">
                <Search size={12} className="mt-0.5 flex-none" />
                Reviewer: the ball’s arrow is longer than the feather’s, so the diagram implies different accelerations.
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-accent-dark">
                <Check size={11} /> Fixed on pass 2 of 3, then approved.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px]">
              <span>
                <span className="text-muted">Real world · SerpApi:</span>{" "}
                <span className="font-medium text-ink">Apollo 15 dropped a hammer and a feather on the Moon</span>
              </span>
              <Send size={14} className="flex-none text-muted" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-10 mb-8 flex flex-none items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-[0_8px_24px_-12px_rgba(20,23,28,0.18)] ring-1 ring-line">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-accent text-white">
          <Mic size={20} />
        </span>
        <div className="flex h-6 flex-none items-center gap-[3px]" aria-hidden>
          {[0, 120, 240, 360, 480].map((d) => (
            <span key={d} className="h-full w-[3px] rounded-full bg-accent motion-safe:animate-bar" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <p key={beat} className="min-w-0 flex-1 truncate text-[16px] text-ink motion-safe:animate-fadein">
          “{TRANSCRIPT[beat]}”
        </p>
        <span className="flex-none text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Listening</span>
      </div>
    </div>
  );
}

function Story() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { enter, progress } = useSectionScroll(ref);
  const open = reduced ? 1 : easeOut(clamp((enter - 0.25) / 0.75));
  const beat = Math.min(BEATS.length - 1, Math.floor(progress * BEATS.length));

  return (
    <section id="how" ref={ref} aria-label="How Ducky works" style={{ height: `${BEATS.length * 80 + 100}vh` }} className="relative">
      <div className="sticky top-12 flex h-[calc(100svh-3rem)] flex-col items-center justify-center gap-8 overflow-hidden px-4">
        <Laptop open={open}>
          <DemoScreen beat={beat} />
        </Laptop>

        <div className="relative h-[112px] w-full max-w-[640px] text-center" style={{ opacity: open }}>
          {BEATS.map((b, i) => (
            <div
              key={b.title}
              aria-hidden={i !== beat}
              className={`absolute inset-0 motion-safe:transition motion-safe:duration-500 ${
                i === beat ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
              }`}
            >
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-accent">{b.eyebrow}</p>
              <p className="mt-1 font-display text-[26px] font-bold leading-tight tracking-[-0.02em] md:text-[34px]">{b.title}</p>
              <p className="mt-1.5 text-[16px] text-sub md:text-[18px]">{b.body}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1.5" aria-hidden style={{ opacity: open }}>
          {BEATS.map((b, i) => (
            <span
              key={b.title}
              className={`h-1.5 rounded-full motion-safe:transition-all ${i === beat ? "w-6 bg-ink" : "w-1.5 bg-edge"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen text-base">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-ground/75 backdrop-blur-xl backdrop-saturate-150">
        <nav className="mx-auto flex h-12 max-w-[1080px] items-center gap-6 px-6 text-[14px]">
          <div className="origin-left scale-[0.8]">
            <Logo />
          </div>
          <div className="flex-1" />
          <a href="#how" className="hidden text-sub no-underline hover:text-ink sm:inline">How it works</a>
          <a href="#research" className="hidden text-sub no-underline hover:text-ink sm:inline">Research</a>
          <Link href="/privacy" className="text-sub no-underline hover:text-ink">Privacy</Link>
          <Link href="/login" className="rounded-full bg-ink px-3.5 py-1 text-[13px] font-medium text-white no-underline hover:bg-sub">
            Log in
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-[980px] px-6 pb-10 pt-20 text-center md:pt-28">
          <p className="font-display text-[19px] font-semibold text-accent md:text-[22px]">Ducky</p>
          <h1 className="mt-2 font-display text-[52px] font-bold leading-[1.02] tracking-[-0.045em] md:text-[96px]">
            Talk it through.
          </h1>
          <p className="mt-3 font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-muted md:text-[46px]">
            Ducky finds where it broke.
          </p>
          <p className="mx-auto mt-6 max-w-[600px] text-[18px] text-sub md:text-[20px]">
            A learning management system where students explain their work out loud and teachers see where the class gets
            stuck.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/login" className="rounded-full bg-accent px-6 py-3 text-[16px] font-semibold text-white no-underline hover:bg-accent-dark">
              Try a session
            </Link>
            <a href="#how" className="text-[16px] font-medium text-accent no-underline hover:underline">
              See how it works ›
            </a>
          </div>
        </section>

        <Story />

        <section id="research" className="scroll-mt-12 bg-ink text-white">
          <div className="mx-auto max-w-[1080px] px-6 py-28 md:py-40">
            <Reveal>
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-accent-glow">Why it works</p>
              <h2 className="mt-3 font-display text-[44px] font-bold leading-[1.04] tracking-[-0.04em] md:text-[76px]">
                Tutoring works.
                <br />
                <span className="text-white/55">It just doesn’t scale.</span>
              </h2>
            </Reveal>
            <Reveal delay={100}>
              <p className="mt-8 max-w-[640px] text-[18px] leading-relaxed text-white/75 md:text-[21px]">
                Intro lectures seat hundreds, and high school teachers often see 150 or more students a day. Nobody can hear
                every student reason through a problem. Ducky can, and it shows the teacher what it heard.
              </p>
            </Reveal>

            {STAT_GROUPS.map((g) => (
              <div key={g.label} className="mt-20 border-t border-white/15 pt-10">
                <Reveal>
                  <h3 className={`text-[13px] font-semibold uppercase tracking-[0.1em] ${g.tone}`}>{g.label}</h3>
                </Reveal>
                <dl className="mt-10 grid gap-x-16 gap-y-16 md:grid-cols-2">
                  {g.stats.map((s, i) => (
                    <Reveal key={s.figure} delay={i * 120}>
                      <dt className={`font-display text-[72px] font-bold leading-none tracking-[-0.05em] md:text-[104px] ${g.tone}`}>
                        {s.figure}
                      </dt>
                      <dd className="mt-4">
                        <span className="block max-w-[420px] text-[19px] leading-snug text-white/90">{s.claim}</span>
                        <span className="mt-3 block text-[13px] text-white/55">{s.source}</span>
                      </dd>
                    </Reveal>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1080px] px-6 py-28 md:py-40">
          <Reveal>
            <h2 className="max-w-[760px] font-display text-[40px] font-bold leading-[1.05] tracking-[-0.04em] md:text-[64px]">
              Built on how people actually learn.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={i * 120} className="flex">
                <div className="flex flex-1 flex-col rounded-[28px] bg-white p-8 shadow-[0_1px_2px_rgba(20,23,28,0.04)] ring-1 ring-line">
                  <p className="font-mono text-[13px] text-muted">0{i + 1}</p>
                  <h3 className="mt-4 font-display text-[24px] font-semibold leading-tight tracking-[-0.02em]">{p.title}</h3>
                  <p className="mt-3 flex-1 text-[16px] leading-relaxed text-sub">{p.body}</p>
                  <p className="mt-6 text-[13px] text-muted">{p.source}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="border-t border-line bg-white">
          <Reveal className="mx-auto max-w-[980px] px-6 py-28 text-center md:py-36">
            <div className="inline-block motion-safe:animate-bob">
              <DuckMark size={64} />
            </div>
            <h2 className="mt-6 font-display text-[44px] font-bold leading-[1.04] tracking-[-0.04em] md:text-[72px]">
              Every student, heard.
            </h2>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/login" className="rounded-full bg-accent px-6 py-3 text-[16px] font-semibold text-white no-underline hover:bg-accent-dark">
                Try a session
              </Link>
              <Link href="/privacy" className="text-[16px] font-medium text-accent no-underline hover:underline">
                How we handle student data ›
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-4 px-6 py-6 text-[12.5px] text-muted">
          <span>Ducky · Built at HackTX 2026</span>
          <div className="flex-1" />
          <Link href="/privacy" className="text-muted no-underline hover:text-ink">Privacy</Link>
          <Link href="/login" className="text-muted no-underline hover:text-ink">Log in</Link>
        </div>
      </footer>
    </div>
  );
}
