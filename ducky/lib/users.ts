/**
 * Shared identity types. Identity itself now lives in Supabase Auth (Google
 * sign-in) and the `profiles` table; there is no mock user list any more.
 */

export type Role = "student" | "teacher";

/** What a signed-in request carries. Built by `getSession()`, never trusted from the client. */
export interface Session {
  userId: string;
  name: string;
  email: string;
  role: Role;
  /** Classes the user belongs to. Queries should be scoped by these, never by request input. */
  classIds: string[];
  permissions: readonly string[];
}

/** Where a role lands after signing in (and where it is sent if it opens a route it cannot use). */
export function homePath(role: Role): string {
  return role === "teacher" ? "/teacher" : "/classes";
}
