/**
 * The single source of truth for "who can do what".
 *
 * Pure module: no `next/headers`, no React. Both the edge middleware and the
 * server-side `getSession()` import it, so the rules cannot drift apart.
 */
import type { Role } from "./users";

/** Cookie that carries the signed-in user's id. */
export const COOKIE_NAME = "ducky_session";

/** Capability sets per role. Add a permission here before checking it anywhere. */
export const ROLE_PERMISSIONS = {
  student: ["session:join", "sketch:send", "hand:raise", "class:join"],
  teacher: [
    "class:view",
    "class:manage",
    "session:join",
    "policy:edit",
    "heatmap:view",
    "transcript:view",
    "transcript:override",
    "audit:view",
    "review:view",
    // A teacher can also be a student in someone else's class.
    "sketch:send",
    "hand:raise",
    "class:join",
  ],
} as const satisfies Record<Role, readonly string[]>;

export type Permission = (typeof ROLE_PERMISSIONS)[Role][number];

/** UI-side check. Hiding controls is UX only; routes and APIs must check too. */
export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission);
}
