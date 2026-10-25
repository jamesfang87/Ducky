import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Privacy policy · Ducky",
  description: "What Ducky collects, who can see it and what we never do with it.",
};

const SECTIONS: { h: string; items: React.ReactNode[] }[] = [
  {
    h: "What we collect",
    items: [
      "Your name and email, from Google or from the email you sign up with, and whether you are a student or a teacher.",
      "Your classes and the problem sets you work on.",
      "What you say or type in a session, plus any sketches you draw. We keep the transcript so you can reopen a past problem set and read it back.",
      "What Ducky notices in your reasoning: the misconceptions it spots (with the quote it used) and rubric scores, including any score a teacher changes.",
      "Problem sets that teachers upload.",
    ],
  },
  {
    h: "What we never do",
    items: [
      "We don’t store your voice. Audio becomes text, and the audio is discarded.",
      "Your work is never used to train AI models.",
      "We don’t sell your data or show ads.",
    ],
  },
  {
    h: "Signing in and staying signed in",
    items: [
      "You can sign in with Google, or with an email and password or a one-time email link. Passwords are handled by Supabase Auth. We never see them.",
      "Every account uses a second step: a code from an authenticator app.",
      "If you choose “Stay signed in,” your sign-in lasts up to 30 days on that device. Without it, you’re signed out when the browser closes.",
      "Even while you stay signed in, Ducky asks for a fresh authenticator code about every 3 hours.",
    ],
  },
  {
    h: "Who can see it",
    items: [
      "Only you can see your saved chat history.",
      "Teachers see sessions from their own classes, and nothing else.",
      "Students never see answer keys or solutions.",
      "Study-buddy matching is opt-in and shows first names only.",
      "Teacher actions, like changing a score, go into an audit log.",
    ],
  },
  {
    h: "Services we use",
    items: [
      "Supabase stores accounts and session data. Google handles Google sign-in.",
      "An AI model provider writes Ducky’s replies, under terms that forbid training on your data.",
      "SerpApi searches the web for study resources and for leaked copies of problems. It gets the problem’s topic and step, or the words a student types into resource search. It never gets the chat itself.",
      "In Chrome and Edge, voice input uses the browser’s built-in speech recognition, which may send audio to the browser maker for transcription.",
    ],
  },
  {
    h: "What stays in your browser",
    items: [
      "A half-finished sign-in form (never the password) is kept for a day, so you don’t lose it if you switch to your email.",
      "Class lists, problem sets, and the teacher dashboard still run on sample data stored in this browser. They never reach our servers.",
      <>
        Clear them any time with <strong>Reset demo</strong> on the teacher page, or by clearing this site’s data in your browser.
      </>,
    ],
  },
  {
    h: "Schools and younger students",
    items: [
      "Ducky hasn’t been reviewed under FERPA or COPPA, so it isn’t ready for K-12 classrooms or for students under 13.",
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
      <SiteHeader />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-16 pt-10">
        <h1 className="font-display text-[36px] font-bold leading-tight tracking-[-0.02em]">Privacy policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated October 24, 2026</p>
        <p className="mt-5 text-[17px] text-sub">
          Ducky helps you learn by talking through your work. Here is what we collect to make that possible, who can see it,
          and what we never do with it.
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
