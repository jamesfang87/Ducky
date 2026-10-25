/**
 * Saves each student's chat per session so it survives a reload and signing out
 * and back in. Stored in Supabase (`chat_histories`, owner-only RLS); if that
 * table isn't there yet, falls back to this browser's localStorage.
 */
import { createClient } from "./supabase/client";
import type { ChatMessage } from "./types";

const MAX_MESSAGES = 500;
const ROLES = new Set(["student", "tutor", "system"]);

const localKey = (userId: string, sessionId: string) => `ducky:chat:${userId}:${sessionId}`;

function clean(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw.filter(
    (m): m is ChatMessage =>
      !!m && typeof m === "object" && typeof m.id === "string" && typeof m.text === "string" && ROLES.has(m.role),
  );
  return out.length ? out : null;
}

function readLocal(userId: string, sessionId: string): ChatMessage[] | null {
  try {
    return clean(JSON.parse(localStorage.getItem(localKey(userId, sessionId)) ?? "null"));
  } catch {
    return null;
  }
}

function writeLocal(userId: string, sessionId: string, messages: ChatMessage[]): void {
  try {
    localStorage.setItem(localKey(userId, sessionId), JSON.stringify(messages));
  } catch {
    // Storage full or blocked; nothing else to try.
  }
}

/** The saved transcript for this session, or null if there isn't one. */
export async function loadChat(userId: string, sessionId: string): Promise<ChatMessage[] | null> {
  const { data, error } = await createClient()
    .from("chat_histories")
    .select("messages")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) return readLocal(userId, sessionId);
  return clean(data?.messages) ?? readLocal(userId, sessionId);
}

export async function saveChat(userId: string, sessionId: string, messages: ChatMessage[]): Promise<void> {
  const trimmed = messages.slice(-MAX_MESSAGES);
  const { error } = await createClient()
    .from("chat_histories")
    .upsert({ user_id: userId, session_id: sessionId, messages: trimmed, updated_at: new Date().toISOString() });
  if (error) writeLocal(userId, sessionId, trimmed);
}
