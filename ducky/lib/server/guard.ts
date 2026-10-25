import "server-only";

import { HttpError, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadUploadedTemplate } from "./assignments";
import { cacheTemplate, getSession, isDemoSession, type ServerSession } from "./store";

/** How long a user's access to an uploaded problem (and its policy) is trusted before re-reading it under RLS. */
const TEMPLATE_TTL_MS = 10_000;
/** `${sessionId}:${userId}` → when that user's access was last confirmed. */
const accessCheckedAt = new Map<string, number>();

/**
 * Shared front door for the tutoring routes: signed in (Supabase + 2FA), allowed to
 * join sessions, and only ever the caller's own copy of the session (GRD-2).
 * Throws HttpError; routes map it to a response.
 */
export async function loadOwnSession(sessionId: unknown): Promise<ServerSession> {
  const user = await requireTutorUser();
  if (typeof sessionId !== "string" || !sessionId) throw new HttpError(400, "sessionId is required.");
  if (!isDemoSession(sessionId)) {
    // Re-read under this user's RLS past the TTL, so access (and the teacher's latest settings) are rechecked.
    const key = `${sessionId}:${user.userId}`;
    const checked = accessCheckedAt.get(key);
    if (checked === undefined || Date.now() - checked > TEMPLATE_TTL_MS) {
      const template = await loadUploadedTemplate(await createClient(), sessionId);
      if (!template) {
        accessCheckedAt.delete(key);
        throw new HttpError(404, "No such session.");
      }
      cacheTemplate(sessionId, template);
      accessCheckedAt.set(key, Date.now());
    }
  }
  const session = getSession(sessionId, user);
  if (!session) throw new HttpError(404, "No such session.");
  return session;
}

/** Signed in (Supabase + 2FA) and allowed to use the tutor. */
export async function requireTutorUser() {
  // Fail closed like middleware.ts: no Supabase keys means nobody is signed in.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new HttpError(503, "Sign-in is not configured on this deployment yet.");
  }
  return requirePermission("session:join");
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Body must be a JSON object.");
  return body as Record<string, unknown>;
}

export function errorStatus(e: unknown): { status: number; message: string } {
  if (e instanceof HttpError) return { status: e.status, message: e.message };
  console.error(e);
  return { status: 500, message: "Something went wrong." };
}
