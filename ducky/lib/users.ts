/**
 * Mock identity table. This is the only place that knows who exists.
 *
 * There is no database and no password check yet: `/api/auth/login` looks a
 * demo user up by role. When Supabase Auth lands, this file goes away and
 * `getSession()` in `lib/auth.ts` becomes the sole thing that changes.
 */

export type Role = "student" | "teacher";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Classes the user belongs to. Queries should be scoped by these, never by request input. */
  classIds: string[];
}

/** What a signed-in request carries. Built by `getSession()`, never trusted from the client. */
export interface Session {
  userId: string;
  name: string;
  email: string;
  role: Role;
  classIds: string[];
  permissions: readonly string[];
}

export const USERS: Record<string, User> = {
  "u_kai": {
    id: "u_kai",
    name: "K. Li",
    email: "kai.li@utexas.edu",
    role: "student",
    classIds: ["phys-1401"],
  },
  "u_rivera": {
    id: "u_rivera",
    name: "D. Rivera",
    email: "d.rivera@utexas.edu",
    role: "teacher",
    classIds: ["phys-1401"],
  },
};

/** Demo login: the role picker signs in as this user. Replace with OAuth once auth is real. */
export const DEMO_USER_BY_ROLE: Record<Role, string> = {
  student: "u_kai",
  teacher: "u_rivera",
};

/** Where a role lands after signing in (and where it is sent if it opens a route it cannot use). */
export function homePath(role: Role): string {
  return role === "teacher" ? "/teacher" : "/session/demo";
}
