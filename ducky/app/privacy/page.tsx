import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Privacy policy · Ducky",
  description: "What Ducky collects, who can see it and what we never do with it.",
};

const SECTIONS: { h: string; items: React.ReactNode[] }[] = [
  {
    h: "What we collect",
    items: [
      "Your name and email from Google sign-in, and whether you are a student or a teacher.",
      "The classes you belong to and the assignments you work on.",
      "Text transcripts of what you say or type during a session, and any sketches you draw.",
      "What Ducky notices about your reasoning: misconceptions it detects (with the quote it based them on) and rubric scores, including any score your teacher changes.",
      "Problem sets that teachers upload.",
    ],
  },
  {
    h: "What we don’t keep or do",
    items: [
      "We don’t store your voice. Audio is turned into text and then thrown away.",
      "Your work is never used to train AI models.",
      "We don’t sell your data or show ads.",
    ],
  },
  {
    h: "Who can see it",
    items: [
      "You can see your own sessions.",
      "Teachers can see sessions only for their own classes.",
      "Students can never see answer keys or solutions.",
      "Study-buddy matching is opt-in and shows first names only.",
      "Teacher actions, like changing a score, are written to an audit log.",
    ],
  },
  {
    h: "Services we use",
    items: [
      "Supabase stores accounts and session data. Google handles sign-in.",
      "An AI model provider generates Ducky’s replies, under terms that don’t allow training on your data.",
      "SerpApi searches the web for leaked copies of problems. It is sent problem text, not student work.",
      "In Chrome and Edge, voice input uses the browser’s built-in speech recognition, which may send audio to the browser maker to be transcribed.",
    ],
  },
  {
    h: "This demo",
    items: [
      "The current version runs on sample data. Anything you do is saved only in your own browser (localStorage) and is never sent to our servers.",
      <>
        Clear it any time with <strong>Reset demo</strong> on the teacher page, or by clearing your browser’s site data.
      </>,
    ],
  },
  {
    h: "Schools and younger students",
    items: [
      "Ducky has not yet been reviewed under FERPA or COPPA, so it isn’t ready for K-12 classrooms or for students under 13.",
    ],
  },
  {
    h: "Your choices",
    items: [
      "To see or delete your data, ask your teacher or school.",
      "If this policy changes, we’ll update the date at the top of this page.",
    ],
  },
];

export default function Privacy() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-[720px] items-center justify-between px-6 py-5">
        <Logo />
        <Link href="/" className="text-sub no-underline hover:text-ink">
          Back to home
        </Link>
      </header>
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-16 pt-4">
        <h1 className="font-display text-[36px] font-bold leading-tight tracking-[-0.02em]">Privacy policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated October 24, 2026</p>
        <p className="mt-5 text-[17px] text-sub">
          Ducky helps you learn by talking through your work. Here is what we collect to do that, who can see it, and
          what we never do with it.
        </p>

        {SECTIONS.map(({ h, items }) => (
          <section key={h} className="mt-8">
            <h2 className="mb-2.5 font-display text-[21px] font-semibold">{h}</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sub marker:text-edge">
              {items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
