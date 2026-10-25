"use client";

import { Student, Teacher } from "@/components/ui/icons";

export type Role = "student" | "teacher";

/** Student/Teacher segmented control, shared by the landing page and the login page. */
export function RoleToggle({ role, onChange }: { role: Role; onChange: (role: Role) => void }) {
  return (
    <div role="group" aria-label="Role" className="grid grid-cols-2 gap-1.5 rounded-xl bg-ground p-1">
      {(["student", "teacher"] as const).map((r) => {
        const Icon = r === "student" ? Student : Teacher;
        return (
          <button
            key={r}
            type="button"
            aria-pressed={role === r}
            onClick={() => onChange(r)}
            className={`flex h-11 items-center justify-center gap-2 rounded-[9px] capitalize transition ${
              role === r ? "bg-surface font-semibold shadow-sm" : "text-sub hover:text-ink"
            }`}
          >
            <Icon className={role === r ? "text-accent" : "text-muted"} />
            {r}
          </button>
        );
      })}
    </div>
  );
}
