import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, can, ROLE_PERMISSIONS, type Permission } from "./permissions";
import { homePath, USERS, type Role, type Session } from "./users";

/**
 * Resolve the signed-in user for this request.
 *
 * The cookie holds a user id, not a role. Roles always come from the server's
 * user table, so a client cannot promote itself by editing the cookie value.
 * (It can still claim another mock user's id — there is no signature yet.
 * That is the one thing Supabase Auth replaces.)
 */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies(); // Next 15: cookies() is async
  const id = jar.get(COOKIE_NAME)?.value;
  if (!id) return null;

  const user = USERS[id];
  if (!user) return null;

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    classIds: user.classIds,
    permissions: ROLE_PERMISSIONS[user.role],
  };
}

/**
 * Server-component guard. Middleware already blocks these routes; this is
 * defense in depth so a page cannot render without a session even if the
 * matcher is misconfigured.
 */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.role)) redirect(homePath(session.role));
  return session;
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

/**
 * Route-handler guard. Call this at the top of every API route that reads or
 * writes real data, and scope queries by `session.classIds`.
 *
 *   try {
 *     const session = await requirePermission("transcript:override");
 *     ...
 *   } catch (e) {
 *     if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
 *     throw e;
 *   }
 */
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Not signed in");
  if (!can(session.role, permission)) throw new HttpError(403, "Forbidden");
  return session;
}
