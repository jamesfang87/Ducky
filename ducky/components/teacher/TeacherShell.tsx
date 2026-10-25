"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountChip } from "@/components/ui/AccountChip";
import { Logo } from "@/components/ui/icons";
import type { TeacherClass } from "@/lib/classroom";

const NAV = [
  { href: "/teacher", label: "My classes" },
  { href: "/teacher/demo", label: "Class overview" },
  { href: "/teacher/agents", label: "Tutor agents" },
  { href: "/teacher/assignments", label: "Assignments" },
  { href: "/teacher/transcripts", label: "Transcripts" },
  { href: "/teacher/help", label: "Help queue" },
];

/** Header + left sidebar shared by the teacher's overview, Tutor agents, Assignments and Transcripts pages. */
export default function TeacherShell({ headerExtra, children }: { headerExtra?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  // A class page counts as "My classes".
  const current = (href: string) => (href === "/teacher" ? pathname === href || pathname.startsWith("/teacher/classes") : pathname.startsWith(href));

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-4 px-6 py-3.5">
          <Logo href="/teacher" badge="for Schools" />
          <div className="flex-1" />
          {headerExtra}
          <AccountChip />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1360px] flex-wrap items-start gap-6 p-6">
        <nav aria-label="Teacher" className="flex max-w-[240px] flex-[1_1_200px] flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={current(n.href) ? "page" : undefined}
              className={`rounded-[10px] px-3 py-2.5 no-underline ${current(n.href) ? "border border-line bg-surface font-semibold text-ink" : "text-sub hover:bg-surface"}`}
            >
              {n.label}
            </Link>
          ))}
          <Link href="/session/demo" className="mt-2 rounded-[10px] px-3 py-2.5 text-accent no-underline hover:bg-surface">
            Preview as student →
          </Link>
        </nav>

        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">{children}</main>
      </div>
    </div>
  );
}

/** Class tabs for pages scoped to one class (?class=<id>). */
export function ClassPicker({ classes, currentId, basePath }: { classes: TeacherClass[]; currentId: string; basePath: string }) {
  if (classes.length < 2) return null;
  return (
    <div role="tablist" aria-label="Class" className="flex flex-wrap gap-1.5">
      {classes.map((c) => (
        <Link
          key={c.id}
          role="tab"
          aria-selected={c.id === currentId}
          href={`${basePath}?class=${c.id}`}
          className={`h-9 rounded-full px-3.5 text-sm leading-9 no-underline transition ${c.id === currentId ? "bg-ink text-ground" : "border border-edge bg-surface text-ink hover:bg-ground"}`}
        >
          {c.courseNumber ? `${c.courseNumber} · ` : ""}
          {c.name}
        </Link>
      ))}
    </div>
  );
}

/** Shown in place of a page's content when something blocks it (no classes yet, missing migration). */
export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-2 p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="text-sm text-sub">{children}</div>
    </div>
  );
}
