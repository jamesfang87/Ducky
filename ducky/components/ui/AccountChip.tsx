"use client";

import { useSession } from "@/lib/session";
import { SignOutButton } from "./SignOutButton";

/** Initials + sign out, shared by the student and teacher headers. */
export function AccountChip() {
  const session = useSession();
  if (!session) return null;

  const initials = session.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-tint text-sm font-semibold text-accent"
        aria-label={`Signed in as ${session.name} (${session.role})`}
        title={`${session.name} · ${session.role}`}
      >
        {initials}
      </span>
      <SignOutButton />
    </div>
  );
}
