"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Check, DuckMark, Logo, Mic, Pencil, Search, Send, Warn } from "@/components/ui/icons";

const BEATS = [
  { eyebrow: "Explain", title: "Students talk it through.", body: "Out loud, in writing, or on a sketch. Step by step, in their own words." },
  { eyebrow: "Catch", title: "It hears where it broke.", body: "Misconceptions are named the moment they show up." },
  { eyebrow: "Fix", title: "Then they fix it themselves.", body: "A hint, never the answer. The correction is theirs." },
  { eyebrow: "Check", title: "Every visual gets a second look.", body: "A second model reviews each diagram before a student sees it." },
  { eyebrow: "Ask", title: "And it keeps asking.", body: "One more question, until the idea actually holds up." },
] as const;

const STAT_GROUPS = [
  {
    label: "The problem",
    tone: "text-[#FF8A7A]",
    stats: [
      {
        figure: "45%",
        claim: "of U.S. 12th graders score below the NAEP Basic level in math, the highest share ever recorded.",
        source: "NAEP 2024 · The Nation’s Report Card, released September 2025",
      },
      {
        figure: "33.8%",
        claim: "of students fail traditional lecture-based STEM courses, versus 21.8% when students actively engage.",
        source: "Freeman et al., PNAS 2014 · 225 studies",
      },
    ],
  },
  {
    label: "What works",
    tone: "text-accent-glow",
    stats: [
      {
        figure: "+0.37 SD",
        claim: "the average learning gain from tutoring, across dozens of randomized trials.",
        source: "Nickow, Oreopoulos & Quan, NBER 2020",
      },
      {
        figure: "2×",
        claim: "the learning gain from an AI tutor versus in-class active learning, in less time, in a randomized trial with Harvard physics students.",
        source: "Kestin et al., Scientific Reports 2025",
      },
    ],
  },
] as const;

const PRINCIPLES = [
  {
    title: "Saying it catches it",
    body: "Students who explain their reasoning build more accurate mental models than those who just read solutions. So students talk through their work instead of pasting in an answer.",
    source: "Self-explanation · Bisra et al., 2018 · 64 studies, g = 0.55",
  },
  {
    title: "Words and pictures together",
    body: "People learn more from explanations paired with visuals than from words alone. Every diagram and simulation is checked by a second model first.",
    source: "Multimedia principle · Mayer, 2009",
  },
  {
    title: "Misconceptions don’t leave on their own",
    body: "Ideas like “heavier things fall faster” survive lectures. Each one is named as it shows up and lands on the teacher’s heatmap.",
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

/** MacBook Air-style device: thin aluminium lid, notch, black glass bezel, hinge and front-lip thumb notch. */
function MacBook({
  open,
  children,
  width = "min(92vw, 1040px, calc((100svh - 3rem - 230px) * 1.5))",
  animate = false,
  sweep = false,
}: {
  open: number;
  children: ReactNode;
  width?: string;
  animate?: boolean;
  sweep?: boolean;
}) {
  return (
    <div className="relative" style={{ width, perspective: "2600px" }}>
      <div
        className="relative rounded-t-[2.4%/3.6%] bg-gradient-to-b from-[#e3e8ef] via-[#cbd3de] to-[#aeb8c6] p-[0.5%] shadow-[0_50px_90px_-30px_rgba(0,0,0,0.65)]"
        style={{
          transform: `rotateX(${-90 * (1 - open)}deg)`,
          transformOrigin: "50% 100%",
          transition: animate ? "transform 1.7s cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
        }}
      >
        <div className="relative rounded-t-[2.1%/3.2%] bg-black p-[1%] pb-[1.15%]">
          {/* camera notch */}
          <div
            aria-hidden
            className="absolute left-1/2 top-0 z-20 flex h-[3.1%] min-h-[6px] w-[8.5%] -translate-x-1/2 items-center justify-center rounded-b-[40%_90%] bg-black"
          >
            <span className="h-[34%] w-[7%] rounded-full bg-[#14233a] ring-1 ring-[#1f3354]" />
          </div>
          <ScaledScreen>
            <div className="h-full overflow-hidden">{children}</div>
          </ScaledScreen>
          {sweep && (
            <div aria-hidden className="pointer-events-none absolute inset-[1%] z-10 overflow-hidden rounded-[3px]">
              <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent motion-safe:animate-sweep" />
            </div>
          )}
          {/* glass reflection */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[1%] z-10 rounded-[3px] bg-[linear-gradient(115deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.04)_28%,transparent_46%)]"
          />
        </div>
      </div>
      {/* base: hinge, slab, thumb notch, contact shadow */}
      <div aria-hidden className="relative -mx-[3.2%]">
        <div className="h-[3px] rounded-t-sm bg-gradient-to-b from-[#7e8998] to-[#a9b3c0]" />
        <div className="relative h-[clamp(9px,1.25vw,16px)] rounded-b-[2.2%_100%] bg-gradient-to-b from-[#eef1f5] via-[#d3dae3] to-[#a7b1be] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="absolute left-1/2 top-0 h-[52%] w-[15%] -translate-x-1/2 rounded-b-[999px] bg-gradient-to-b from-[#9aa5b3] to-[#b8c1cd]" />
        </div>
        <div className="absolute -bottom-5 left-[6%] right-[6%] h-6 rounded-full bg-black/55 blur-xl" />
      </div>
    </div>
  );
}

function Aura({ on }: { on: boolean }) {
  // Soft teal clouds that drift and bounce behind the laptop. One hue family only.
  const clouds = [
    { cls: "right-[2%] top-[-8%] h-[62vmin] w-[62vmin] animate-cloud-a", bg: "rgba(111,211,182,0.85)" },
    { cls: "right-[26%] bottom-[-16%] h-[56vmin] w-[56vmin] animate-cloud-b", bg: "rgba(16,160,128,0.8)" },
    { cls: "right-[-6%] bottom-[6%] h-[48vmin] w-[48vmin] animate-cloud-c", bg: "rgba(160,235,214,0.6)" },
    { cls: "right-[34%] top-[6%] h-[40vmin] w-[40vmin] animate-cloud-d", bg: "rgba(60,190,160,0.7)" },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 transition-opacity duration-[2000ms]" style={{ opacity: on ? 1 : 0 }}>
        {clouds.map((c) => (
          <span
            key={c.cls}
            className={`absolute rounded-full blur-[70px] motion-reduce:animate-none ${c.cls}`}
            style={{ background: `radial-gradient(closest-side, ${c.bg}, transparent 100%)` }}
          />
        ))}
      </div>
      <div
        className="absolute inset-0 opacity-[0.3] [mask-image:radial-gradient(70%_60%_at_65%_50%,black,transparent)]"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
      />
    </div>
  );
}

function FloatCard({ className, children, show, delay }: { className: string; children: ReactNode; show: boolean; delay: number }) {
  return (
    <div
      className={`absolute z-30 hidden rounded-xl border border-white/15 bg-[#0d1319] px-4 py-3 text-[13px] text-white shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)] lg:block ${className}`}
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0) scale(1)" : "translateY(18px) scale(0.96)",
        transition: `opacity 900ms ${delay}ms cubic-bezier(0.16,1,0.3,1), transform 900ms ${delay}ms cubic-bezier(0.16,1,0.3,1)`,
      }}
    >
      <div>{children}</div>
    </div>
  );
}

type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; phase: number; white: boolean };

/** Four-point star particles: a soft ambient shimmer plus a burst when the laptop lands and when the lid opens. */
function Sparkles({ fire, ambient }: { fire: number; ambient: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparks = useRef<Spark[]>([]);
  const dims = useRef({ w: 0, h: 0 });
  const ambientRef = useRef(ambient);
  ambientRef.current = ambient;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let visible = true;
    let last = performance.now();

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dims.current = { w: r.width, h: r.height };
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const star = (x: number, y: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.quadraticCurveTo(x, y, x, y + r);
      ctx.quadraticCurveTo(x, y, x - r, y);
      ctx.quadraticCurveTo(x, y, x, y - r);
      ctx.fill();
    };
    const frame = (now: number) => {
      raf = 0;
      if (!visible) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w, h } = dims.current;
      ctx.clearRect(0, 0, w, h);
      if (ambientRef.current && sparks.current.length < 60 && Math.random() < 0.3) {
        sparks.current.push({
          x: w * (0.3 + Math.random() * 0.7),
          y: h * (0.1 + Math.random() * 0.8),
          vx: (Math.random() - 0.5) * 8,
          vy: -4 - Math.random() * 10,
          life: 0,
          max: 2.4 + Math.random() * 2.4,
          size: 1.5 + Math.random() * 2.5,
          phase: Math.random() * 6,
          white: Math.random() < 0.5,
        });
      }
      sparks.current = sparks.current.filter((p) => p.life < p.max);
      for (const p of sparks.current) {
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.992;
        p.vy *= 0.992;
        const t = p.life / p.max;
        ctx.globalAlpha = Math.max(0, Math.sin(Math.PI * t) * (0.7 + 0.3 * Math.sin(p.phase + p.life * 9)));
        ctx.fillStyle = p.white ? "#FFFFFF" : "#6FD3B6";
        star(p.x, p.y, p.size * (0.55 + 0.45 * Math.sin(Math.PI * t)));
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(canvas);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!fire) return;
    const { w, h } = dims.current;
    const count = fire === 1 ? 70 : 170;
    const cx = w * (fire === 1 ? 0.86 : 0.64);
    const cy = h * 0.46;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * (fire === 1 ? 260 : 520);
      sparks.current.push({
        x: cx + (Math.random() - 0.5) * 60,
        y: cy + (Math.random() - 0.5) * 40,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed * 0.7,
        life: 0,
        max: 1.2 + Math.random() * 1.8,
        size: 2 + Math.random() * 5,
        phase: Math.random() * 6,
        white: Math.random() < 0.55,
      });
    }
  }, [fire]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 z-[25] h-full w-full" />;
}

function Hero() {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0); // 0 waiting, 1 sliding in, 2 lid open
  const [beat, setBeat] = useState(0);
  const [hs, setHs] = useState(0); // 0 to 1 as the hero scrolls away

  useEffect(() => {
    if (reduced) {
      setStage(2);
      return;
    }
    const t1 = setTimeout(() => setStage(1), 150);
    const t2 = setTimeout(() => setStage(2), 1650);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reduced]);

  useEffect(() => {
    if (stage < 2 || reduced) return;
    const id = setInterval(() => setBeat((b) => (b + 1) % BEATS.length), 3000);
    return () => clearInterval(id);
  }, [stage, reduced]);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      setHs(clamp(window.scrollY / (window.innerHeight * 0.8)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const rise = (delay: number, extra: string) => ({
    className: `transition-all duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${extra}`,
    style: {
      transitionDelay: `${delay}ms`,
      opacity: stage >= 1 ? 1 : 0,
      transform: stage >= 1 ? "translateY(0)" : "translateY(28px)",
    },
  });

  return (
    <section className="relative isolate overflow-hidden bg-[#05080c] text-white">
      <Aura on={stage >= 1} />
      {!reduced && <Sparkles fire={stage} ambient={stage >= 1} />}
      {stage >= 2 && !reduced && (
        <div
          aria-hidden
          className="pointer-events-none absolute right-[8%] top-1/2 z-[5] h-[80vmin] w-[80vmin] -translate-y-1/2 rounded-full motion-safe:animate-bloom"
          style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.85), rgba(111,211,182,0.45) 45%, transparent 100%)" }}
        />
      )}
      <div className="relative mx-auto grid min-h-[calc(100svh-3rem)] max-w-[1440px] items-center gap-8 px-6 pb-28 pt-14 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,1.55fr)] lg:pt-8">
        <div className="relative z-20" style={{ opacity: 1 - hs * 1.3, transform: `translateY(${-hs * 70}px)` }}>
          <p {...rise(0, "text-[13px] font-semibold uppercase tracking-[0.14em] text-accent-glow")}>Built at HackTX 2026</p>
          <h1 {...rise(120, "mt-4 font-display text-[56px] font-bold leading-[0.98] tracking-[-0.045em] md:text-[88px]")}>
            Talk it
            <br />
            through.
          </h1>
          <p {...rise(260, "mt-4 font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-accent-glow md:text-[40px]")}>
            Find exactly where it broke.
          </p>
          <p {...rise(400, "mt-6 max-w-[500px] text-[18px] leading-relaxed text-white/70 md:text-[20px]")}>
            Students explain their work out loud, in writing, or with a sketch. Teachers see where the whole class gets stuck.
          </p>
          <div {...rise(540, "mt-9 flex flex-wrap items-center gap-5")}>
            <Link href="/login" className="rounded-full bg-white px-7 py-3.5 text-[16px] font-semibold text-ink no-underline transition-colors hover:bg-white/85">
              Try a session
            </Link>
            <a href="#how" className="text-[16px] font-medium text-accent-glow no-underline hover:underline">
              See how it works ›
            </a>
          </div>
          <ul {...rise(700, "mt-12 grid max-w-[520px] grid-cols-3 gap-4 border-t border-white/10 pt-6 text-[13px] text-white/60")}>
            <li><span className="block font-display text-[22px] font-semibold text-white">3 ways</span>to explain it: voice, text, sketch</li>
            <li><span className="block font-display text-[22px] font-semibold text-white">Live</span>class heatmap for teachers</li>
            <li><span className="block font-display text-[22px] font-semibold text-white">2-step</span>sign-in protects student data</li>
          </ul>
        </div>

        <div className="relative" style={{ transform: `translateY(${hs * 60}px) scale(${1 + hs * 0.08})` }}>
          <div
            style={{
              transform: stage >= 1 ? "translateX(0) scale(1)" : "translateX(60vw) scale(0.9)",
              opacity: stage >= 1 ? 1 : 0,
              transition: "transform 1.8s cubic-bezier(0.16,1,0.3,1), opacity 1.1s ease-out",
            }}
          >
            <MacBook open={stage >= 2 ? 1 : 0} animate sweep={stage >= 2 && !reduced} width="100%">
              <DemoScreen beat={stage >= 2 ? beat : 0} />
            </MacBook>
          </div>
          <FloatCard show={stage >= 2} delay={700} className="left-[3%] top-[-13%]">
            <p className="flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full bg-[#FF9A5A]" /> Misconception caught</p>
            <p className="mt-0.5 text-white/65">Mass changes fall speed</p>
          </FloatCard>
          <FloatCard show={stage >= 2} delay={1100} className="right-[3%] top-[-13%]">
            <p className="flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full bg-accent-glow" /> Diagram approved</p>
            <p className="mt-0.5 text-white/65">Second model, pass 2 of 3</p>
          </FloatCard>
          <FloatCard show={stage >= 2} delay={1500} className="bottom-[-15%] right-[12%]">
            <p className="flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full bg-white" /> Teacher heatmap updated</p>
            <p className="mt-0.5 text-white/65">Sample class data</p>
          </FloatCard>
        </div>
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-ground" />
    </section>
  );
}

function SiteHeader() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const onScroll = () => setDark(window.scrollY < window.innerHeight * 0.75);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const link = dark ? "text-white/75 hover:text-white" : "text-sub hover:text-ink";
  return (
    <header className={`sticky top-0 z-40 border-b transition-colors duration-500 ${dark ? "border-white/10 bg-gradient-to-r from-[#06100f] via-[#0c2a24] to-[#06100f]" : "border-line bg-ground"}`}>
      <nav className="mx-auto flex h-12 max-w-[1080px] items-center gap-6 px-6 text-[14px]">
        <div className={`origin-left scale-[0.8] ${dark ? "[&_*]:!text-white" : ""}`}>
          <Logo />
        </div>
        <div className="flex-1" />
        <a href="#how" className={`hidden no-underline sm:inline ${link}`}>How it works</a>
        <a href="#research" className={`hidden no-underline sm:inline ${link}`}>Research</a>
        <Link href="/privacy" className={`no-underline ${link}`}>Privacy</Link>
        <Link
          href="/login"
          className={`rounded-full px-3.5 py-1 text-[13px] font-medium no-underline transition-colors ${dark ? "bg-white text-ink hover:bg-white/85" : "bg-ink text-white hover:bg-sub"}`}
        >
          Log in
        </Link>
      </nav>
    </header>
  );
}

const PATH_STEPS = ["Set up knowns: h, m₁, m₂, v₀ = 0", "Predict what happens", "Relate F = ma to each ball", "Solve for t"];
// How many reasoning steps are done at each beat.
const PATH_DONE = [1, 1, 3, 3, 4];

type Msg = { from: "ducky" | "you"; at: number; text: string; flag?: string };

const CHAT: Msg[] = [
  { from: "ducky", at: 0, text: "Before we calculate anything: if you drop both balls at the same moment, what do you expect to happen?" },
  { from: "you", at: 0, text: "Gravity pulls the 10 kg ball with about 98 N, and the 1 kg ball with about 9.8 N." },
  { from: "you", at: 1, text: "So more force on the big ball. It has to fall faster, right?" },
  {
    from: "ducky",
    at: 1,
    flag: "Misconception caught: mass changes fall speed",
    text: "Force and speed aren’t the same thing. What does F = ma say about how quickly each ball speeds up?",
  },
  { from: "you", at: 2, text: "Oh. a = F/m. 98/10 and 9.8/1 both give 9.8 m/s², so the mass cancels." },
  { from: "ducky", at: 2, text: "That’s it, and the fix is yours. What does that mean for how long each one takes to fall?" },
  { from: "you", at: 3, text: "Can you show me the forces drawn out?" },
  { from: "ducky", at: 3, text: "Drawing it now. A second model checks the diagram before you see it." },
  { from: "you", at: 4, text: "Both land at t = √(2h/g) ≈ 2.0 s." },
  { from: "ducky", at: 4, text: "Now put the air back in. What else is pushing on a feather?" },
];

function PathMarker({ state }: { state: "done" | "active" | "flag" | "todo" }) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent text-white transition-colors duration-500">
        <Check size={12} />
      </span>
    );
  }
  if (state === "flag") {
    return (
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-warn text-[12px] font-bold text-white">!</span>
    );
  }
  if (state === "active") return <span className="h-6 w-6 flex-none rounded-full border-2 border-accent bg-accent-tint" />;
  return <span className="h-6 w-6 flex-none rounded-full border-2 border-edge" />;
}

/** A faithful miniature of the real student session view (problem, reasoning path, chat, visualization). */
function DemoScreen({ beat }: { beat: number }) {
  const done = PATH_DONE[beat];
  const msgs = CHAT.filter((m) => m.at <= beat);
  const stepState = (i: number) => (i < done ? "done" : i === done ? (beat === 1 ? "flag" : "active") : "todo");
  const segs = [1, beat >= 4 ? 1 : 0.5, 0, 0, 0, 0];
  const showViz = beat >= 3;

  return (
    <div className="flex h-full flex-col bg-ground text-[14px] text-ink">
      <header className="flex h-14 flex-none items-center gap-4 border-b border-line bg-white px-6">
        <DuckMark size={28} />
        <span className="font-display text-[22px] font-bold tracking-tight">ducky</span>
        <nav className="ml-2 flex items-center gap-2 text-[14px] text-muted">
          <span>PHYS 1401</span>
          <span aria-hidden>/</span>
          <span>Problem Set 3 · Free fall</span>
          <span aria-hidden>/</span>
          <span className="font-semibold text-ink">Problem 2 of 6</span>
        </nav>
        <div className="flex-1" />
        <span className="chip">2 hints max</span>
        <span className="chip">Answers hidden</span>
        <span className="text-[14px] text-sub">Teacher view</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-tint text-[12px] font-bold text-accent">KS</span>
        <span className="text-[14px] text-sub">Sign out</span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[304px_minmax(0,1fr)_296px] gap-4 p-4">
        {/* left: problem, reasoning path, where to learn, misconceptions */}
        <div className="flex min-h-0 flex-col gap-4">
          <section className="rounded-2xl border border-line bg-white p-4">
            <div className="flex gap-2" aria-hidden>
              {segs.map((s, i) => (
                <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${s * 100}%` }} />
                </span>
              ))}
            </div>
            <p className="eyebrow mt-4">Problem 2</p>
            <p className="mt-1 text-[14.5px] leading-snug">
              A 1.0 kg ball and a 10 kg ball are dropped from rest at h = 20 m. Ignoring air resistance, find the time each takes to
              reach the ground and explain why.
            </p>
          </section>

          <section className="rounded-2xl border border-line bg-white p-4">
            <h3 className="font-display text-[16px] font-semibold">Your reasoning path</h3>
            <ol className="mt-3 flex flex-col gap-2">
              {PATH_STEPS.map((s, i) => {
                const st = stepState(i);
                return (
                  <li key={s} className="flex items-center gap-3">
                    <PathMarker state={st} />
                    <span className={`text-[14px] transition-colors duration-500 ${st === "todo" ? "text-muted" : st === "flag" ? "font-semibold text-warn" : st === "active" ? "font-semibold text-ink" : "text-sub"}`}>
                      {s}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="rounded-2xl border border-line bg-white p-4">
            <h3 className="font-display text-[16px] font-semibold">Where to learn this</h3>
            <div className="relative mt-2 h-9">
              <p className={`absolute inset-0 text-[12.5px] leading-snug text-muted transition-opacity duration-500 ${beat >= 2 ? "opacity-0" : "opacity-100"}`}>
                Explanations and notes on the idea you’re working on, not answers to this problem.
              </p>
              <p className={`absolute inset-0 text-[12.5px] leading-snug text-sub transition-opacity duration-500 ${beat >= 2 ? "opacity-100" : "opacity-0"}`}>
                <span className="font-semibold text-ink">Apollo 15 dropped a hammer and a feather on the Moon.</span>{" "}
                <span className="text-muted">Found with SerpApi</span>
              </p>
            </div>
            <div className="mt-2 flex gap-2">
              <span className="flex h-9 flex-1 items-center rounded-xl border border-edge px-3 text-[13px] text-muted">Your current step</span>
              <span className="flex h-9 items-center rounded-xl border border-edge px-3 text-[13px] font-medium">Find</span>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-[16px] font-semibold">Misconception tracker</h3>
              <span className="text-[12.5px] text-muted">this unit</span>
            </div>
            {[
              { name: "Mass changes fall speed", n: beat >= 1 ? 3 : 2 },
              { name: "Velocity vs. acceleration", n: 2 },
            ].map((r) => (
              <div key={r.name} className="mt-3">
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="text-sub">{r.name}</span>
                  <span className="font-mono text-[12.5px] font-semibold text-warn">{r.n}×</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ground">
                  <div className="h-full rounded-full bg-heat-3 transition-[width] duration-700" style={{ width: `${r.n * 25}%` }} />
                </div>
              </div>
            ))}
          </section>
        </div>

        {/* center: the conversation */}
        <section className="flex min-h-0 flex-col rounded-2xl border border-line bg-white">
          <div className="flex flex-none items-center gap-3 border-b border-line px-5 py-3.5">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="font-display text-[17px] font-semibold">Talk it through</span>
            <span className="text-[12.5px] text-muted">Socratic tutor · stays on this problem</span>
            <div className="flex-1" />
            <span className="font-mono text-[12.5px] text-muted">Hints 0 / 2</span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden px-5 py-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex flex-col gap-1 motion-safe:animate-fadein ${m.from === "you" ? "items-end" : "items-start"}`}>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{m.from === "you" ? "You" : "Ducky"}</span>
                {m.flag && (
                  <span className="flex items-center gap-1.5 rounded-full bg-warn-tint px-2.5 py-1 text-[11.5px] font-semibold text-warn">
                    <Warn size={11} /> {m.flag}
                  </span>
                )}
                <p
                  className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-[14px] leading-snug ${
                    m.from === "you" ? "bg-accent text-white" : "bg-ground text-ink"
                  }`}
                >
                  {m.text}
                </p>
              </div>
            ))}
          </div>

          <div className="flex-none border-t border-line p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-accent text-white ring-4 ring-accent-tint">
                <Mic size={20} />
              </span>
              <span className="text-[14px] font-semibold">Tap to talk, or type below</span>
              <div className="flex h-5 items-center gap-[3px]" aria-hidden>
                {[0, 120, 240, 360].map((d) => (
                  <span key={d} className="h-full w-[3px] rounded-full bg-accent motion-safe:animate-bar" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="flex h-10 flex-1 items-center rounded-xl border border-edge px-3 text-[14px] text-muted">Type your reasoning...</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/50 text-white">
                <Send size={15} />
              </span>
              <span className="flex h-10 items-center gap-1.5 rounded-xl border border-edge px-3 text-[14px]">
                <Pencil size={14} /> Sketch
              </span>
              <span className="flex h-10 items-center rounded-xl border border-edge px-3 text-[14px]">Use hint (2 left)</span>
            </div>
          </div>
        </section>

        {/* right: visualization */}
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex items-baseline justify-between px-1">
            <span className="eyebrow">Visualization</span>
            <span className="text-[13px] text-sub">Minimize</span>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-white">
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center transition-opacity duration-500 ${showViz ? "opacity-0" : "opacity-100"}`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-accent text-accent">
                <Search size={20} />
              </span>
              <p className="font-display text-[17px] font-semibold">Want to see it?</p>
              <p className="text-[13px] leading-snug text-sub">Ask in the chat (“can you show me?”) or describe what you want to see from this problem.</p>
              <span className="mt-1 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-white">Show me visually</span>
            </div>

            <div className={`absolute inset-0 flex flex-col gap-3 p-4 transition-opacity duration-700 ${showViz ? "opacity-100" : "opacity-0"}`}>
              <svg viewBox="0 0 320 168" className="block h-auto w-full" aria-hidden="true">
                <path d="M22 20v118" stroke="#C9CCC6" strokeWidth="1.5" strokeDasharray="4 4" />
                <text x="28" y="18" fontFamily="var(--font-inter)" fontSize="10" fill="#5A626C">h = 20 m</text>
                <path d="M12 146h296" stroke="#C9CCC6" strokeWidth="2" strokeLinecap="round" />
                <circle cx="96" cy="52" r="20" fill="#14171C" />
                <text x="96" y="56" textAnchor="middle" fontFamily="var(--font-inter)" fontSize="10" fill="#FFFFFF">10 kg</text>
                <circle cx="224" cy="52" r="11" fill="#0B7A62" />
                <text x="224" y="56" textAnchor="middle" fontFamily="var(--font-inter)" fontSize="9" fill="#FFFFFF">1 kg</text>
                <path d="M96 84v40m-4-5 4 5 4-5" stroke="#0B7A62" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M224 84v40m-4-5 4 5 4-5" stroke="#0B7A62" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <text x="308" y="164" textAnchor="end" fontFamily="var(--font-inter)" fontSize="10" fill="#5A626C">t ≈ 2.0 s</text>
              </svg>
              <p className="text-center text-[12.5px] leading-snug text-muted">Equal arrows: both accelerate at 9.8 m/s² and land together.</p>
              <div className="rounded-xl border border-line p-3 text-[12.5px] leading-snug">
                <p className="flex items-center gap-1.5 font-semibold text-ink">
                  <Pencil size={12} /> Generated a free-body diagram
                </p>
                <p className="mt-1.5 flex items-start gap-1.5 text-muted">
                  <Search size={12} className="mt-0.5 flex-none" />
                  Reviewer: the 10 kg ball’s arrow is longer, so the diagram implies different accelerations.
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-accent-dark">
                  <Check size={11} /> Fixed on pass 2 of 3, then approved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Words brighten one by one as the paragraph scrolls through the viewport. */
function ScrollWords({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduced = useReducedMotion();
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      setP(clamp((vh * 0.85 - r.top) / (vh * 0.45 + r.height)));
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
  }, []);
  const words = text.split(" ");
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <span key={i} className="transition-opacity duration-200" style={{ opacity: reduced ? 1 : 0.25 + 0.75 * clamp(p * words.length * 1.15 - i) }}>
          {w}{" "}
        </span>
      ))}
    </p>
  );
}

function Story() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { enter, progress } = useSectionScroll(ref);

  // 1) the laptop grows and opens as it arrives, 2) the beats play, 3) it zooms until the screen fills the view.
  const open = reduced ? 1 : easeOut(clamp((enter - 0.2) / 0.6));
  const beat = Math.min(BEATS.length - 1, Math.floor(clamp(progress / 0.78) * BEATS.length));
  const zoom = reduced ? 0 : easeOut(clamp((progress - 0.8) / 0.2));
  const arrive = reduced ? 1 : 0.78 + 0.22 * easeOut(clamp(enter / 0.9));
  const scale = arrive * (1 + 0.9 * zoom);
  const captionOpacity = open * clamp(1 - zoom * 3);

  return (
    <section id="how" ref={ref} aria-label="How Ducky works" style={{ height: `${BEATS.length * 80 + 190}vh` }} className="relative">
      <div className="sticky top-12 flex h-[calc(100svh-3rem)] flex-col items-center justify-center gap-8 overflow-hidden px-4">
        <div style={{ transform: `scale(${scale})`, transformOrigin: "50% 40%" }}>
          <MacBook open={open} width="min(94vw, 1180px, calc((100svh - 15rem) * 1.55))">
            <DemoScreen beat={beat} />
          </MacBook>
        </div>

        <div className="relative h-[112px] w-full max-w-[640px] text-center" style={{ opacity: captionOpacity }}>
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

        <div className="flex gap-1.5" aria-hidden style={{ opacity: captionOpacity }}>
          {BEATS.map((b, i) => (
            <span key={b.title} className={`h-1.5 rounded-full motion-safe:transition-all ${i === beat ? "w-6 bg-ink" : "w-1.5 bg-edge"}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen text-base">
      <SiteHeader />

      <main>
        <Hero />

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
            <ScrollWords
              className="mt-8 max-w-[640px] text-[18px] leading-relaxed text-white md:text-[21px]"
              text="Intro lectures seat hundreds, and high school teachers often see 150 or more students a day. Nobody can hear every student reason through a problem. Now someone can, and the teacher sees what it heard."
            />

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
            <div className="inline-block">
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
