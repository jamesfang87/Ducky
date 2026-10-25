import type { ReactNode } from "react";

const svg = (d: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

const BENEFITS = [
  {
    icon: svg(<><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>),
    title: "Your progress is saved",
    body: "Every explanation, hint, and finished step is stored. Close the tab and nothing is lost.",
  },
  {
    icon: svg(<><path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.4" /><path d="M3 4v4h4M12 8v4l3 2" /></>),
    title: "Revisit earlier problems",
    body: "Reopen a past set and read the full transcript: how you reasoned, where you slipped, and how you fixed it.",
  },
  {
    icon: svg(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></>),
    title: "Explain it your way",
    body: "Talk it out, type it, or sketch it. Ducky catches where your reasoning breaks and asks the question that gets you past it.",
  },
  {
    icon: svg(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>),
    title: "Your answers stay yours",
    body: "Answers never reach your browser, and a 2-step check keeps your account locked down.",
  },
] as const;

export function Benefits() {
  return (
    <div>
      <p className="eyebrow">Create / Sign in</p>
      <h1 className="mt-2 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] md:text-[48px]">
        Pick up exactly where you left off.
      </h1>
      <ul className="mt-8 grid gap-6">
        {BENEFITS.map((b) => (
          <li key={b.title} className="flex gap-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent-tint text-accent">{b.icon}</span>
            <div>
              <p className="font-display text-[17px] font-semibold">{b.title}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-sub">{b.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
