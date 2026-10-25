import "server-only";

import { redirect } from "next/navigation";
import { mfaSatisfied } from "./mfa";
import { can, ROLE_PERMISSIONS, type Permission } from "./permissions";
import { createClient } from "./supabase/server";
import { homePath, type Role, type Session } from "./users";

export type AuthState =
  | { status: "anon" }
  | { status: "needs_mfa" }
  | { status: "needs_role" }
  | { status: "ok"; session: Session };

/**
 * Resolve the signed-in user for this request from Supabase Auth.
 *
 * `getUser()` re-validates the token with Supabase on every call (it never just
 * trusts the cookie). A session only counts once the user has passed the second
 * factor (aal2), so a stolen Google login alone gets nothing.
 */
export async function getAuthState(): Promise<AuthState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "anon" };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!mfaSatisfied(aal)) return { status: "needs_mfa" };

  const { data: profile } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).maybeSingle();
  const role = profile?.role as Role | null | undefined;
  if (role !== "student" && role !== "teacher") return { status: "needs_role" };

  // Class membership comes from the database under the user's own RLS, never from request input.
  const table = role === "teacher" ? supabase.from("classes").select("id") : supabase.from("enrollments").select("class_id");
  const { data: rows } = await table;
  const classIds = (rows ?? []).map((r) => ("id" in r ? r.id : r.class_id) as string);

  return {
    status: "ok",
    session: {
      userId: user.id,
      name: profile?.full_name || user.email?.split("@")[0] || "User",
      email: profile?.email || user.email || "",
      role,
      classIds,
      permissions: ROLE_PERMISSIONS[role],
    },
  };
}

export async function getSession(): Promise<Session | null> {
  const state = await getAuthState();
  return state.status === "ok" ? state.session : null;
}

/**
 * Server-component guard. Middleware already blocks these routes; this is
 * defense in depth so a page cannot render without a full session.
 */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const state = await getAuthState();
  if (state.status === "anon" || state.status === "needs_role") redirect("/login");
  if (state.status === "needs_mfa") redirect("/mfa");
  if (!roles.includes(state.session.role)) redirect(homePath(state.session.role));
  return state.session;
}

/** Thrown by `requirePermission`; route handlers can map it to a JSON response. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Route-handler guard. Call at the top of every API route that reads or writes real data. */
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Not signed in");
  if (!can(session.role, permission)) throw new HttpError(403, "Forbidden");
  return session;
}
